// controllers/adminController.ts
import multer from "multer";
import Order from "../models/pickupOrder";
import User from "../models/users";
import { Request, Response } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import {
  createOrderAssignedNotification,
  createOrderCompletedNotification,
} from "../services/notificationService";
import { updateItemQuantities } from "../utils/stockHelper";

// Define valid order statuses
type OrderStatus = "pending" | "assigntocourier" | "completed" | "cancelled";

interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: Date;
  updatedBy?: string; // Admin/system who made the change
}

export const assignCourierToOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { courierId, status } = req.body;

  try {
    console.log("🚀 Assigning courier to order...");
    console.log("Order ID:", orderId);
    console.log("Courier ID:", courierId);
    console.log("New Status:", status);

    // 1. Validate required fields
    if (!courierId || !status) {
      return res.status(400).json({
        message: "Courier ID and status are required",
      });
    }

    // 2. Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Current Order Status:", order.status);

    // 3. Validate courier exists and has delivery role
    const courier = await User.findById(courierId);
    if (!courier || courier.role !== "delivery") {
      return res.status(400).json({
        message: "Invalid courier - user not found or not a delivery person",
      });
    }

    console.log("✅ Courier validated:", courier.name);

    // 4. Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ["assigntocourier", "cancelled"],
      assigntocourier: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    const currentStatus = order.status.toLowerCase() as OrderStatus;
    const newStatus = status.toLowerCase() as OrderStatus;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
      });
    }

    // 5. Update order with proper ObjectId conversion
    order.courier = new mongoose.Types.ObjectId(courierId);
    order.status = newStatus;

    console.log("Before Save → Order Object:", {
      status: order.status,
      courier: order.courier,
    });

    // Initialize statusHistory if it doesn't exist and add current status
    if (!order.statusHistory || order.statusHistory.length === 0) {
      order.statusHistory = [
        {
          status: "pending",
          timestamp: order.createdAt || new Date(),
          updatedBy: "system",
        },
      ];
    }

    // Add new status to history
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      updatedBy: req.user?.userId || "admin",
    });

    // Save the order
    const savedOrder = await order.save();

    console.log("After Save → Saved Order:", {
      status: savedOrder.status,
      courier: savedOrder.courier,
    });

    // Create notification if order is assigned to courier
    if (newStatus === "assigntocourier") {
      try {
        const userId = order.user.userId.toString();
        await createOrderAssignedNotification(userId, orderId);
        console.log(
          `✅ Notification created for user ${userId} - order assigned`
        );
      } catch (notificationError) {
        console.error("❌ Error creating notification:", notificationError);
        // Don't fail the request if notification fails
      }
    }

    // 6. Try to populate courier info for response (with error handling)
    let populatedOrder = savedOrder;
    try {
      populatedOrder = await Order.findById(savedOrder._id)
        .populate("courier", "name phoneNumber email imgUrl") // User schema fields
        .populate("user.userId", "name phoneNumber email imgUrl"); // User schema fields

      console.log("✅ Order populated successfully");
    } catch (populateError) {
      console.warn(
        "⚠️ Population failed, using unpopulated order:",
        populateError.message
      );
      // Continue without population
    }

    res.status(200).json({
      message: "Courier assigned successfully",
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        createdAt: populatedOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Assign courier error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "delivery-proofs", // ✅ This goes inside the async return
      format: "png", // or 'jpeg' / 'jpg' based on file
      public_id: `delivery-proof-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}`,
    };
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

export const uploadProof = multer({
  storage: cloudinaryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export const getCourierAssignedOrders = async (req: Request, res: Response) => {
  try {
    const courierId = req.user?.userId;
    console.log("🔍 Looking for orders assigned to courier ID:", courierId);

    if (!courierId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Debug: Check total orders with this courier (any status)
    const totalOrdersWithCourier = await Order.countDocuments({
      courier: courierId,
    });
    console.log(
      "📋 Total orders assigned to this courier:",
      totalOrdersWithCourier
    );

    // Debug: Check orders with specific status
    const ordersWithStatus = await Order.countDocuments({
      courier: courierId,
      status: "assigntocourier",
    });
    console.log("📋 Orders with assigntocourier status:", ordersWithStatus);

    // Get the actual orders
    const orders = await Order.find({
      courier: courierId,
      status: "assigntocourier",
    })
      .populate("user.userId", "name phoneNumber email imgUrl") // Populate with User schema fields
      .populate("courier", "name phoneNumber email imgUrl") // Populate with User schema fields
      .sort({ createdAt: -1 });

    console.log("✅ Found orders for courier:", orders.length);

    // Debug: Log first order details if exists
    if (orders.length > 0) {
      console.log("First order details:", {
        id: orders[0]._id,
        status: orders[0].status,
        courierId: orders[0].courier,
      });
    }

    // Clean up the response to avoid duplication and match Order schema structure
    const cleanedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      // If user.userId is populated, update the user object with populated data
      if (orderObj.user?.userId && typeof orderObj.user.userId === "object") {
        const populatedUser = orderObj.user.userId as any; // Type assertion for populated fields

        // Debug: Log the populated user data
        console.log("Populated user data:", populatedUser);
        console.log("User imgUrl:", populatedUser.imgUrl);

        // Create a clean user object with only the fields we need (no nested userId)
        orderObj.user = {
          userId: populatedUser._id, // Use the _id as a string, not the full object
          phoneNumber: populatedUser.phoneNumber || orderObj.user.phoneNumber,
          userName: populatedUser.name || orderObj.user.userName, // Map 'name' to 'userName'
          email: populatedUser.email || orderObj.user.email,
          image: populatedUser.imgUrl || orderObj.user.image || null, // Map 'imgUrl' to 'image'
        };

        // Debug: Log the final user object
        console.log("Final user object:", orderObj.user);
      }

      return orderObj;
    });

    res.status(200).json({ orders: cleanedOrders });
  } catch (error) {
    console.error("❌ Get courier orders error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const completeOrderWithProof = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const proofPhoto = req.file as Express.Multer.File;

    console.log("📸 Completing order with photo proof...");
    console.log("Order ID:", orderId);
    console.log("Courier ID:", req.user?.userId);
    console.log("Photo:", proofPhoto?.filename);

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    // 1. Validate photo is provided
    if (!proofPhoto) {
      return res.status(400).json({
        message: "Delivery proof photo is required",
      });
    }

    // 2. Find and validate order
    const order = await Order.findById(orderId);
    if (!order) {
      // Clean up uploaded file if order not found
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(404).json({ message: "Order not found" });
    }

    // 3. Validate courier is assigned to this order
    if (!order.courier || order.courier.toString() !== req.user?.userId) {
      // Clean up uploaded file
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(403).json({
        message: "You are not assigned to this order",
      });
    }

    // 4. Validate current status
    if (order.status.toLowerCase() !== "assigntocourier") {
      // Clean up uploaded file
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(400).json({
        message: "Order cannot be completed from current status",
      });
    }

    // 5. Update order status and add delivery proof
    order.status = "completed";
    order.deliveryProof = {
      photoPath: proofPhoto.filename,
      photoUrl: proofPhoto.path,
      uploadedAt: new Date(),
      notes: notes || "",
      completedBy: new mongoose.Types.ObjectId(req.user?.userId),
    };

    // 6. Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      status: "completed",
      timestamp: new Date(),
      updatedBy: req.user?.userId || "courier",
      notes: `Order completed with delivery proof${notes ? `: ${notes}` : ""}`,
    });

    // 7. Set completion timestamp
    order.completedAt = new Date();

    // 8. Save the order
    const savedOrder = await order.save();

    // 🎯 NEW: AWARD POINTS TO THE USER
    try {
      // Calculate total points from items array (points * quantity for each item)
      const totalPointsToAward = order.items.reduce((sum, item) => {
        return sum + item.points * item.quantity;
      }, 0);

      console.log(
        "Items breakdown:",
        order.items.map((item) => ({
          itemName: item.itemName,
          points: item.points,
          quantity: item.quantity,
          totalPoints: item.points * item.quantity,
        }))
      );
      console.log("Total points to award:", totalPointsToAward);

      // Award points using your existing function logic
      const user = await User.findById(order.user.userId);
      if (user && totalPointsToAward > 0) {
        // Update user's total points
        user.totalPoints = (user.totalPoints || 0) + totalPointsToAward;

        // Add to points history
        if (!user.pointsHistory) {
          user.pointsHistory = [];
        }

        user.pointsHistory.push({
          orderId: savedOrder._id.toString(),
          points: totalPointsToAward,
          type: "earned",
          reason: "Order completion",
          timestamp: new Date(),
        });

        // Save user with updated points
        await user.save();

        console.log(
          `✅ Awarded ${totalPointsToAward} points to user ${user._id} for order ${savedOrder._id}`
        );
      }
    } catch (pointsError) {
      console.error("❌ Error awarding points:", pointsError);
      // Don't fail the entire operation if points fail
    }

    console.log("✅ Order completed with proof:", {
      orderId: savedOrder._id,
      proofPhoto: proofPhoto.filename,
      completedAt: savedOrder.completedAt,
    });

    // Create completion notification
    try {
      const userId = order.user.userId.toString();
      const totalPointsToAward = order.items.reduce(
        (sum, item) => sum + item.points * item.quantity,
        0
      );
      await createOrderCompletedNotification(userId, orderId);
      console.log(`✅ Completion notification created for user ${userId}`);
    } catch (notificationError) {
      console.error(
        "❌ Error creating completion notification:",
        notificationError
      );
      // Don't fail the request if notification fails
    }

    // 9. Populate and return response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate("courier", "name phoneNumber email imgUrl") // User schema fields
      .populate("user.userId", "name phoneNumber email imgUrl"); // User schema fields

    //10. update stock with new Quantities
    try {
      await updateItemQuantities(order.items, "increase");
      console.log("✅ Restocked item quantities for completed order.");
    } catch (restockError) {
      console.error("❌ Failed to restock items:", restockError);
    }

    res.status(200).json({
      message: "Order completed successfully with delivery proof",
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        deliveryProof: populatedOrder.deliveryProof,
        completedAt: populatedOrder.completedAt,
        createdAt: populatedOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Complete order with proof error:", error);

    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
