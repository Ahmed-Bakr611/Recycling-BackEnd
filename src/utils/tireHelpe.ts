import { getSocketIO } from "../socket/socketServer";
import User from "../models/users"; // adjust import path
import { createAndEmitNotification } from "../services/notificationService";

export const rewardLevels = [
  {
    id: 1,
    name: "Eco Starter",
    minPoints: 0,
    maxPoints: 1499,
    bonusPoints: 25,
  },
  {
    id: 2,
    name: "Green Helper",
    minPoints: 1500,
    maxPoints: 3499,
    bonusPoints: 50,
  },
  {
    id: 3,
    name: "Silver Recycler",
    minPoints: 3500,
    maxPoints: 5999,
    bonusPoints: 75,
  },
  {
    id: 4,
    name: "Gold Guardian",
    minPoints: 6000,
    maxPoints: 8999,
    bonusPoints: 100,
  },
  {
    id: 5,
    name: "Platinum Pioneer",
    minPoints: 9000,
    maxPoints: 12499,
    bonusPoints: 125,
  },
  {
    id: 6,
    name: "Diamond Elite",
    minPoints: 12500,
    maxPoints: 999999,
    bonusPoints: 150,
  },
];

interface ProcessPointsResult {
  newTotalPoints: number;
  bonusPointsAdded: number;
}

export function getTierByPoints(points: number) {
  return rewardLevels.find(
    (tier) => points >= tier.minPoints && points <= tier.maxPoints
  );
}
export function calculatePointsWithBonus(
  currentPoints: number,
  pointsToAdd: number
) {
  const oldTier = getTierByPoints(currentPoints);
  let newTotalPoints = currentPoints + pointsToAdd;
  const newTier = getTierByPoints(newTotalPoints);

  let bonusPointsAdded = 0;

  if (newTier && oldTier && newTier.id > oldTier.id) {
    // Example: get bonus from tier, or fixed 100
    // Assuming rewardLevels have bonusPoints field, otherwise fallback to 100
    bonusPointsAdded = newTier.bonusPoints ?? 100;

    newTotalPoints += bonusPointsAdded;
  }

  return { newTotalPoints, bonusPointsAdded };
}

export async function processUserPoints(
  userId: string,
  points: number, // positive to add, negative to deduct
  reason?: string
): Promise<ProcessPointsResult> {
  console.log(
    "-------------------- 🤦‍♂️🤦‍♂️🤦‍♂️🤦‍♂️🤦‍♂️PROCESSING USER POINTS 🤦‍♂️🤦‍♂️🤦‍♂️🤦‍♂️🤦‍♂️-------------------------------"
  );
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const io = getSocketIO();
  if (!io) {
    console.error("Socket.IO not initialized");
    return;
  }
  // console.log(`Processing points for user ${user}`);
  const oldPoints = user.totalPoints || 0;
  let newTotalPoints = oldPoints + points;
  if (newTotalPoints < 0) newTotalPoints = 0;

  let bonusPointsAdded = 0;

  // Handle bonus points only when adding points (points > 0)
  if (points > 0) {
    const oldTier = getTierByPoints(oldPoints);
    const nextTier = rewardLevels.find(
      (tier) => tier.id === (oldTier?.id ?? 0) + 1
    );

    if (nextTier && newTotalPoints >= nextTier.minPoints) {
      bonusPointsAdded = nextTier.bonusPoints ?? 0;
      newTotalPoints += bonusPointsAdded;
    }
  }

  user.totalPoints = newTotalPoints;

  if (!user.pointsHistory) user.pointsHistory = [];

  const def = points > 0 ? "Points awarded" : "Points deducted";
  const msg = reason ? reason : def;
  user.pointsHistory.push({
    points,
    type: points > 0 ? "earned" : "deducted",
    reason: msg,
    timestamp: new Date(),
  });

  // Add bonus history entry if bonus applied
  if (bonusPointsAdded > 0) {
    user.pointsHistory.push({
      points: bonusPointsAdded,
      type: "earned",
      reason: `Bonus points for reaching the ${
        rewardLevels.find((t) => t.bonusPoints === bonusPointsAdded)?.name
      } tier`,
      timestamp: new Date(),
    });
  }

  await user.save();
  io.to(`user_${userId}`).emit("points:updated", {
    totalPoints: newTotalPoints,
  });

  // Notify tier change (up or down)
  notifyTierChange(userId, oldPoints, newTotalPoints);

  return { newTotalPoints, bonusPointsAdded };
}
export const notifyTierChange = async (
  userId: string,
  oldPoints: number,
  newPoints: number
): Promise<void> => {
  const oldTier = getTierByPoints(oldPoints);
  const newTier = getTierByPoints(newPoints);

  console.log(
    `Notifying tier change for user ${userId}: oldTier=${oldTier?.name}, newTier=${newTier?.name}`
  );
  console.log(`Old Points: ${oldPoints} Vs  New Points: ${newPoints}`);
  console.log("-------------------------------------------");
  if (!oldTier || !newTier) return;
  const io = getSocketIO();
  if (!io) {
    console.error("Socket.IO not initialized");
    return;
  }

  if (newTier.id > oldTier.id) {
    const nextTier = rewardLevels.find((tier) => tier.id === oldTier.id + 1);
    if (nextTier && newTier.id >= nextTier.id) {
      await createAndEmitNotification({
        userId,
        title: `Tier Upgrade: ${nextTier.name}`,
        body: `🎉 Congrats! You reached the ${nextTier.name} tier! Keep it up!`,
        type: "system",
      });
      console.log(`🎉 User ${userId} upgraded to ${nextTier.name} tier!`);
    }
  } else if (newTier.id < oldTier.id) {
    await createAndEmitNotification({
      userId,
      title: `Tier Downgrade: ${newTier.name}`,
      body: `⚠️ Your points dropped to the ${newTier.name} tier. Keep recycling to climb back up!`,
      type: "system",
    });
    console.log(`⚠️ User ${userId} downgraded to ${newTier.name} tier.`);
  }
};

export const notifyOrdersUpdates = (userId, updatedOrder) => {
  const io = getSocketIO();

  if (io) {
    io.to(`user_${userId}`).emit("order:update", {
      orderId: updatedOrder._id,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
    });
  }
};
