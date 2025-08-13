import { getSocketIO } from "../socket/socketServer";
import User, { IUser } from "../models/users"; // adjust import path
import { createAndEmitNotification } from "../services/notificationService";
import Order from "../models/pickupOrder";
import { get } from "http";

export const rewardLevels = [
  {
    id: 1,
    name: "Eco Beginner",
    minRecycles: 0,
    maxRecycles: 4,
    bonusPerOrder: 1,
    bonusPerReachedTier: 50,
  },

  {
    id: 2,
    name: "Eco Starter",
    minRecycles: 5,
    maxRecycles: 14,
    bonusPerOrder: 5,
    bonusPerReachedTier: 150,
  },
  {
    id: 3,
    name: "Green Helper",
    minRecycles: 15,
    maxRecycles: 29,
    bonusPerOrder: 10,
    bonusPerReachedTier: 300,
  },
  {
    id: 4,
    name: "Silver Recycler",
    minRecycles: 30,
    maxRecycles: 49,
    bonusPerOrder: 15,
    bonusPerReachedTier: 500,
  },
  {
    id: 5,
    name: "Gold Guardian",
    minRecycles: 20,
    maxRecycles: 74,
    bonusPerOrder: 20,
    bonusPerReachedTier: 700,
  },
  {
    id: 6,
    name: "Platinum Pioneer",
    minRecycles: 75,
    maxRecycles: 99,
    bonusPerOrder: 25,
    bonusPerReachedTier: 850,
  },
  {
    id: 7,
    name: "Diamond Elite",
    minRecycles: 100,
    maxRecycles: 999999,
    bonusPerOrder: 30,
    bonusPerReachedTier: 1000,
  },
];

interface ProcessPointsResult {
  newTotalPoints: number;
  bonusPointsAdded: number;
}

export function getTierByTotalRecycles(totalRecycles: number) {
  return rewardLevels.find(
    (tier) =>
      totalRecycles >= tier.minRecycles && totalRecycles <= tier.maxRecycles
  );
}

export async function getCompletedOrdersCount(userId: string) {
  try {
    const count = await Order.countDocuments({
      "user.userId": userId,
      status: "completed",
    });

    return count; // will be 0 if none found
  } catch (err) {
    console.error("Error fetching completed orders count:", err);
    throw err;
  }
}
export function convertPointsToMoney(points: number): number {
  return parseFloat((points / 19).toFixed(2));
}

export async function getTierBonusPoints(userId: string) {
  let completedOrdersCount = await getCompletedOrdersCount(userId);
  let currentTier = getTierByTotalRecycles(completedOrdersCount);
  if (!currentTier) return { bonusPoints: 0, reachedNewTier: false };

  // Get previous tier based on (completedOrdersCount - 1)
  let previousTier = getTierByTotalRecycles(completedOrdersCount - 1);

  const reachedNewTier = !previousTier || previousTier.id !== currentTier.id;

  let bonusPoints =
    currentTier.bonusPerOrder +
    (reachedNewTier ? currentTier.bonusPerReachedTier : 0);

  return { bonusPoints, reachedNewTier, tier: currentTier };
}

export async function processUserPoints(
  userId: string,
  points: number, // positive to add, negative to deduct
  reason?: string
): Promise<ProcessPointsResult> {
  console.log("▶ PROCESSING USER POINTS");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const def =
    points > 0
      ? "Reward for your recent eco-friendly activity"
      : "Points deducted for recent action";
  const msg = reason || def;

  let newTotalPoints = user.totalPoints || 0;
  newTotalPoints += points;
  if (newTotalPoints < 0) newTotalPoints = 0;

  let bonusPointsAdded = 0;
  let reachedNewTier = false;
  let tier = null;

  if (points > 0) {
    const tierBonusData = await getTierBonusPoints(userId);
    bonusPointsAdded = tierBonusData.bonusPoints;
    reachedNewTier = tierBonusData.reachedNewTier;
    tier = tierBonusData.tier;
    newTotalPoints += bonusPointsAdded;
  } else if (msg.toLowerCase().startsWith("cashback")) {
    console.log("Handling cashback deduction");
    await handleCashBack(userId, -points);
  }

  user.totalPoints = newTotalPoints;

  if (!user.pointsHistory) user.pointsHistory = [];

  user.pointsHistory.push({
    points,
    type: points > 0 ? "earned" : "deducted",
    reason: msg,
    timestamp: new Date(),
  });

  // Bonus points record
  if (bonusPointsAdded > 0 && tier) {
    user.pointsHistory.push({
      points: bonusPointsAdded,
      type: "earned",
      reason: reachedNewTier
        ? `Tier milestone — you reached ${tier.name}`
        : `Bonus for completing an order as a ${tier.name}`,
      timestamp: new Date(),
    });
  }

  await user.save();

  // Only notify when the tier was reached now
  if (reachedNewTier && tier) {
    await createAndEmitNotification({
      userId,
      title: `Tier Upgrade: ${tier.name}`,
      body: `🎉 Congrats! You reached the ${tier.name} tier! Keep it up!`,
      type: "system",
    });
    console.log(`🎉 User ${userId} upgraded to ${tier.name} tier!`);
  }

  return { newTotalPoints, bonusPointsAdded };
}

const handleCashBack = async (userId: string, points: number) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  user.attachments = user.attachments || {};
  user.attachments.balance = user.attachments.balance || 0;
  user.attachments.transactions = user.attachments.transactions || [];

  const cashbackAmount = convertPointsToMoney(points);
  user.attachments.transactions.push({
    type: "cashback",
    amount: cashbackAmount,
    date: new Date(),
  });
  user.attachments.balance += cashbackAmount;
  user.markModified("attachments");
  await user.save();
};
