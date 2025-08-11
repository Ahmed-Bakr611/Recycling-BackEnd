import express, { Request, Response } from "express";
import Order from "../models/pickupOrder"; // Use the comprehensive schema
import User from "../models/users";

import { IAuthenticatedRequest } from "./pickupController";
import { calculateOrderPoints } from "./pickupController"; // Import the points calculation function
import {
  getTierByPoints,
  notifyTierChange,
  calculatePointsWithBonus,
  processUserPoints,
} from "../utils/tireHelpe";

export const addUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, orderId, reason = "Order completion" } = req.body;

    if (!points || points <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid points amount" });
    }

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // const oldPoints = user.totalPoints || 0;

    // Calculate new total points and bonus
    const { newTotalPoints, bonusPointsAdded } = await processUserPoints(
      userId,
      points
    );

    // user.totalPoints = newTotalPoints;

    // // Add base points entry

    // await user.save();

    return res.status(200).json({
      success: true,
      message: "Points added successfully",
      data: {
        userId: user._id,
        totalPoints: user.totalPoints,
        pointsAdded: points,
        bonusPointsAdded,
      },
    });
  } catch (error) {
    console.error("Error adding points:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while adding points" });
  }
};

export const deductUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, reason = "Points deduction" } = req.body;

    console.log(
      "-----------------------kkkkkkkk-------------------------------------"
    );
    console.log(reason);
    if (!points || points <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid points amount" });
    }

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const oldPoints = user.totalPoints || 0;

    if (oldPoints < points) {
      return res.status(400).json({
        success: false,
        message: "Insufficient points",
        data: { currentPoints: oldPoints, requestedPoints: points },
      });
    }

    const { newTotalPoints, bonusPointsAdded } = await processUserPoints(
      userId,
      -points,
      reason
    );
    // // const newTotalPoints = oldPoints - points;
    // user.totalPoints = newTotalPoints;

    // await user.save();

    return res.status(200).json({
      success: true,
      message: "Points deducted successfully",
      data: {
        userId: user._id,
        totalPoints: user.totalPoints,
        pointsDeducted: points,
      },
    });
  } catch (error) {
    console.error("Error deducting points:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while deducting points" });
  }
};

export const getUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;

    const user = await User.findById(userId).select(
      "totalPoints pointsHistory name email"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Paginate points history
    const pointsHistory = user.pointsHistory || [];
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedHistory = pointsHistory
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints || 0,
        pointsHistory: paginatedHistory,
        pagination: {
          currentPage: Number(page),
          totalItems: pointsHistory.length,
          totalPages: Math.ceil(pointsHistory.length / Number(limit)),
          hasMore: endIndex < pointsHistory.length,
        },
      },
    });
  } catch (error) {
    console.error("Error getting user points:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching points",
    });
  }
};

export const getPointsLeaderboard = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const topUsers = await User.find({ totalPoints: { $gt: 0 } })
      .select("name email totalPoints imgUrl")
      .sort({ totalPoints: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: topUsers.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints || 0,
        imageUrl: user.imgUrl || "",
      })),
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching leaderboard",
    });
  }
};

export const getUserOrdersWithPoints = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;

    const orders = await Order.find({ "user.userId": userId }).sort({
      createdAt: -1,
    });

    const ordersWithPoints = orders.map((order) => ({
      ...order.toObject(),
      pointsEarned:
        order.status === "completed" ? calculateOrderPoints(order.items) : 0,
      potentialPoints: calculateOrderPoints(order.items),
    }));

    res.json({
      success: true,
      count: ordersWithPoints.length,
      data: ordersWithPoints,
    });
  } catch (error) {
    console.error("Error fetching user orders with points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
