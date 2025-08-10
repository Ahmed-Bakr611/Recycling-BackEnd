import { getSocketIO } from "../socket/socketServer";
import User from "../models/users"; // adjust import path

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
  points: number // positive to add, negative to deduct
): Promise<ProcessPointsResult> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

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

  user.pointsHistory.push({
    points,
    type: points > 0 ? "earned" : "deducted",
    reason: points > 0 ? "Points awarded" : "Points deducted",
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

  // Notify tier change (up or down)
  notifyTierChange(userId, oldPoints, newTotalPoints);

  return { newTotalPoints, bonusPointsAdded };
}

export function notifyTierChange(
  userId: string,
  oldPoints: number,
  newPoints: number
) {
  const io = getSocketIO();

  const oldTier = getTierByPoints(oldPoints);
  const newTier = getTierByPoints(newPoints);

  if (!oldTier || !newTier) return;

  if (newTier.id > oldTier.id) {
    const nextTier = rewardLevels.find((tier) => tier.id === oldTier.id + 1);

    if (nextTier && newTier.id >= nextTier.id) {
      io.to(userId).emit("tier-upgrade", {
        message: `🎉 Congrats! You reached the ${nextTier.name} tier! Keep it up!`,
        newTier: nextTier,
        totalPoints: newPoints,
      });
    }
  } else if (newTier.id < oldTier.id) {
    io.to(userId).emit("tier-downgrade", {
      message: `⚠️ Your points dropped to the ${newTier.name} tier. Keep recycling to climb back up!`,
      newTier,
      totalPoints: newPoints,
    });
  }
}
