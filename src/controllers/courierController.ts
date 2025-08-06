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

// Updated to include 'collected' status
type OrderStatus = "pending" | "assigntocourier" | "collected" | "completed" | "cancelled";

interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: Date;
  updatedBy?: string;
}

export const assignCourierToOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { courierId, status } = req.body;

  try {
    console.log("🚀 Assigning courier to order...");
    console.log("Order ID:", orderId);
    console.log("Courier ID:", courierId);
    console.log("New Status:", status);

    if (!courierId || !status) {
      return res.status(400).json({
        message: "Courier ID and status are required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Current Order Status:", order.status);

    const courier = await User.findById(courierId);
    if (!courier || courier.role !== "delivery") {
      return res.status(400).json({
        message: "Invalid courier - user not found or not a delivery person",
      });
    }

    console.log("✅ Courier validated:", courier.name);

    // Updated status transitions to include 'collected' and handle buyer logic
    const getValidTransitions = (userRole: string): Record<OrderStatus, OrderStatus[]> => {
      if (userRole === "buyer") {
        // Buyers skip collected status - can complete directly from assigntocourier
        return {
          pending: ["assigntocourier", "cancelled"],
          assigntocourier: ["completed", "cancelled"], // Buyers can complete directly
          collected: ["completed", "cancelled"], // Should not occur for buyers but handle it
          completed: [],
          cancelled: [],
        };
      } else {
        // Customers use collected status flow
        return {
          pending: ["assigntocourier", "cancelled"],
          assigntocourier: ["collected", "cancelled"], // Must go to collected first
          collected: ["completed", "cancelled"], // Only admins can complete from collected
          completed: [],
          cancelled: [],
        };
      }
    };

    // Get user role to determine valid transitions
    const user = await User.findById(order.user.userId);
    const userRole = user?.role || "customer";
    
    const validTransitions = getValidTransitions(userRole);

    const currentStatus = order.status.toLowerCase() as OrderStatus;
    const newStatus = status.toLowerCase() as OrderStatus;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
      });
    }

    order.courier = new mongoose.Types.ObjectId(courierId);
    order.status = newStatus;

    console.log("Before Save → Order Object:", {
      status: order.status,
      courier: order.courier,
    });

    if (!order.statusHistory || order.statusHistory.length === 0) {
      order.statusHistory = [
        {
          status: "pending",
          timestamp: order.createdAt || new Date(),
          updatedBy: "system",
        },
      ];
    }

    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      updatedBy: req.user?.userId || "admin",
    });

    const savedOrder = await order.save();

    console.log("After Save → Saved Order:", {
      status: savedOrder.status,
      courier: savedOrder.courier,
    });

    if (newStatus === "assigntocourier") {
      try {
        const userId = order.user.userId.toString();
        await createOrderAssignedNotification(userId, orderId);
        console.log(
          `✅ Notification created for user ${userId} - order assigned`
        );
      } catch (notificationError) {
        console.error("❌ Error creating notification:", notificationError);
      }
    }

    let populatedOrder = savedOrder;
    try {
      populatedOrder = await Order.findById(savedOrder._id)
        .populate("courier", "name phoneNumber email imgUrl")
        .populate("user.userId", "name phoneNumber email imgUrl");

      console.log("✅ Order populated successfully");
    } catch (populateError) {
      console.warn(
        "⚠️ Population failed, using unpopulated order:",
        populateError.message
      );
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
      folder: "delivery-proofs",
      format: "png",
      public_id: `delivery-proof-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}`,
    };
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
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

    const totalOrdersWithCourier = await Order.countDocuments({
      courier: courierId,
    });
    console.log(
      "📋 Total orders assigned to this courier:",
      totalOrdersWithCourier
    );

    const ordersWithStatus = await Order.countDocuments({
      courier: courierId,
      status: "assigntocourier",
    });
    console.log("📋 Orders with assigntocourier status:", ordersWithStatus);

    const orders = await Order.find({
      courier: courierId,
      status: "assigntocourier",
    })
      .populate("user.userId", "name phoneNumber email imgUrl role")
      .populate("courier", "name phoneNumber email imgUrl role")
      .sort({ createdAt: -1 });

    console.log("✅ Found orders for courier:", orders.length);

    if (orders.length > 0) {
      console.log("First order details:", {
        id: orders[0]._id,
        status: orders[0].status,
        courierId: orders[0].courier,
      });
    }

    const cleanedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      if (orderObj.user?.userId && typeof orderObj.user.userId === "object") {
        const populatedUser = orderObj.user.userId as any;

        console.log("Populated user data:", populatedUser);
        console.log("User imgUrl:", populatedUser.imgUrl);
        console.log("User role:", populatedUser.role);

        orderObj.user = {
          userId: populatedUser._id,
          phoneNumber: populatedUser.phoneNumber || orderObj.user.phoneNumber,
          userName: populatedUser.name || orderObj.user.userName,
          email: populatedUser.email || orderObj.user.email,
          image: populatedUser.imgUrl || orderObj.user.image || null,
          role: populatedUser.role || orderObj.user.role || null,
        };

        console.log("Final user object:", orderObj.user);
      }

      if (orderObj.courier && typeof orderObj.courier === "object") {
        const populatedCourier = orderObj.courier as any;
        console.log("Courier role:", populatedCourier.role);
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

// UPDATED: This function now handles quantity updates and estimated weight for customers
export const markOrderAsCollected = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { notes, updatedQuantities, quantityNotes } = req.body;
    const proofPhoto = req.file as Express.Multer.File;

    console.log("📦 Processing order completion/collection...");
    console.log("Order ID:", orderId);
    console.log("Courier ID:", req.user?.userId);
    console.log("Photo:", proofPhoto?.filename);
    console.log("Updated Quantities:", updatedQuantities);
    console.log("Quantity Notes:", quantityNotes);

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      if (proofPhoto?.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate courier is assigned to this order
    if (!order.courier || order.courier.toString() !== req.user?.userId) {
      if (proofPhoto?.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(403).json({
        message: "You are not assigned to this order",
      });
    }

    // Validate current status
    if (order.status.toLowerCase() !== "assigntocourier") {
      if (proofPhoto?.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(400).json({
        message: "Order cannot be processed from current status",
      });
    }

    // Get user role to determine flow
    const user = await User.findById(order.user.userId);
    const userRole = user?.role || "customer";

    console.log(`📋 Processing ${userRole} order`);

    // Handle quantity updates for customer orders
    if (userRole === "customer" && updatedQuantities) {
      try {
        const parsedQuantities = typeof updatedQuantities === 'string' 
          ? JSON.parse(updatedQuantities) 
          : updatedQuantities;

        console.log("📊 Processing quantity updates for customer order");
        
        // Update item quantities based on actual measurements
        order.items = order.items.map((item) => {
          const itemId = item._id.toString();
          if (parsedQuantities[itemId]) {
            const quantityData = parsedQuantities[itemId];
            const originalQuantity = item.quantity;
            const actualQuantity = quantityData.actualQuantity;
            
            console.log(`📏 Item ${item.itemName}: ${originalQuantity} → ${actualQuantity}`);
            
            // Store original quantity if not already stored
            if (!item.originalQuantity) {
              item.originalQuantity = originalQuantity;
            }
            
            // Update to actual quantity
            item.quantity = actualQuantity;
            item.quantityAdjusted = originalQuantity !== actualQuantity;
          }
          return item;
        });

        // Store quantity adjustment notes
        if (quantityNotes) {
          order.quantityAdjustmentNotes = quantityNotes;
        }

        console.log("✅ Item quantities updated based on actual measurements");
      } catch (quantityError) {
        console.error("❌ Error processing quantity updates:", quantityError);
        // Continue processing even if quantity update fails
      }
    }

    if (userRole === "buyer") {
      // BUYER FLOW: Complete directly (skip collected status)
      console.log("🏢 Buyer order - completing directly");
      
      order.status = "completed";
      order.completedAt = new Date();

      // Store estimated weight for buyers in notes
      if (notes) {
        order.estimatedWeight = notes;
      }

      // Award points immediately for buyer orders
      try {
        const totalPointsToAward = order.items.reduce((sum, item) => {
          return sum + item.points * item.quantity;
        }, 0);

        if (user && totalPointsToAward > 0) {
          user.totalPoints = (user.totalPoints || 0) + totalPointsToAward;

          if (!user.pointsHistory) {
            user.pointsHistory = [];
          }

          user.pointsHistory.push({
            orderId: order._id.toString(),
            points: totalPointsToAward,
            type: "earned",
            reason: "Buyer order completion",
            timestamp: new Date(),
          });

          await user.save();
          console.log(`✅ Awarded ${totalPointsToAward} points to buyer ${user._id}`);
        }
      } catch (pointsError) {
        console.error("❌ Error awarding points to buyer:", pointsError);
      }

      // Update stock for buyer orders
      try {
        await updateItemQuantities(order.items, "increase");
        console.log("✅ Restocked item quantities for buyer order.");
      } catch (restockError) {
        console.error("❌ Failed to restock items:", restockError);
      }

      // Create completion notification for buyers
      try {
        await createOrderCompletedNotification(order.user.userId.toString(), orderId);
        console.log(`✅ Completion notification sent to buyer`);
      } catch (notificationError) {
        console.error("❌ Error creating completion notification:", notificationError);
      }

    } else {
      // CUSTOMER FLOW: Mark as collected (admin will complete later)
      console.log("👤 Customer order - marking as collected");
      order.status = "collected";
      order.collectedAt = new Date();

      // Store estimated weight for customer orders
      if (notes) {
        order.estimatedWeight = notes;
      }
    }

    // Add delivery proof if photo provided
    if (proofPhoto) {
      order.deliveryProof = {
        photoPath: proofPhoto.filename,
        photoUrl: proofPhoto.path,
        uploadedAt: new Date(),
        notes: notes || "",
        completedBy: new mongoose.Types.ObjectId(req.user?.userId),
      };
    }

    // Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }

    const historyNotes = [];
    if (userRole === "customer" && order.quantityAdjustmentNotes) {
      historyNotes.push(`Quantity adjustments: ${order.quantityAdjustmentNotes}`);
    }
    if (notes) {
      historyNotes.push(`Estimated weight: ${notes}`);
    }

    order.statusHistory.push({
      status: userRole === "buyer" ? "completed" : "collected",
      timestamp: new Date(),
      updatedBy: req.user?.userId || "courier",
      notes: `${userRole === "buyer" ? "Order completed" : "Order collected"} by courier${historyNotes.length > 0 ? `. ${historyNotes.join('. ')}` : ""}`,
    });

    const savedOrder = await order.save();

    console.log(`✅ Order ${userRole === "buyer" ? "completed" : "collected"}:`, {
      orderId: savedOrder._id,
      status: savedOrder.status,
      userRole,
      quantityAdjusted: userRole === "customer" ? savedOrder.items.some(item => item.quantityAdjusted) : false,
    });

    // Populate and return response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate("courier", "name phoneNumber email imgUrl")
      .populate("user.userId", "name phoneNumber email imgUrl");

    res.status(200).json({
      message: `Order ${userRole === "buyer" ? "completed" : "marked as collected"} successfully`,
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        deliveryProof: populatedOrder.deliveryProof,
        collectedAt: populatedOrder.collectedAt,
        completedAt: populatedOrder.completedAt,
        estimatedWeight: populatedOrder.estimatedWeight,
        quantityAdjustmentNotes: populatedOrder.quantityAdjustmentNotes,
        createdAt: populatedOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Process order error:", error);

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

// NEW: Admin function to complete orders from collected status (with points)
export const completeOrderFromCollected = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { adminNotes } = req.body;

    console.log("✅ Admin completing order from collected status...");
    console.log("Order ID:", orderId);
    console.log("Admin ID:", req.user?.userId);

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate current status is collected
    if (order.status.toLowerCase() !== "collected") {
      return res.status(400).json({
        message: "Order must be in 'collected' status to be completed by admin",
      });
    }

    // Update order status to completed
    order.status = "completed";

    // Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      status: "completed",
      timestamp: new Date(),
      updatedBy: req.user?.userId || "admin",
      notes: `Order completed by admin${adminNotes ? `: ${adminNotes}` : ""}`,
    });

    // Set completion timestamp
    order.completedAt = new Date();

    const savedOrder = await order.save();

    // 🎯 AWARD POINTS TO THE USER (using updated quantities)
    try {
      const totalPointsToAward = order.items.reduce((sum, item) => {
        return sum + item.points * item.quantity; // This now uses the adjusted quantity
      }, 0);

      console.log(
        "Items breakdown:",
        order.items.map((item) => ({
          name: item.itemName,
          points: item.points,
          quantity: item.quantity, // Now shows adjusted quantity
          originalQuantity: item.originalQuantity,
          quantityAdjusted: item.quantityAdjusted,
          totalPoints: item.points * item.quantity,
        }))
      );
      console.log("Total points to award (based on actual quantities):", totalPointsToAward);

      const user = await User.findById(order.user.userId);
      if (user && totalPointsToAward > 0) {
        user.totalPoints = (user.totalPoints || 0) + totalPointsToAward;

        if (!user.pointsHistory) {
          user.pointsHistory = [];
        }

        user.pointsHistory.push({
          orderId: savedOrder._id.toString(),
          points: totalPointsToAward,
          type: "earned",
          reason: "Order completion by admin (actual quantities)",
          timestamp: new Date(),
        });

        await user.save();

        console.log(
          `✅ Awarded ${totalPointsToAward} points to user ${user._id} for order ${savedOrder._id} (based on actual quantities)`
        );
      }
    } catch (pointsError) {
      console.error("❌ Error awarding points:", pointsError);
    }

    console.log("✅ Order completed by admin:", {
      orderId: savedOrder._id,
      completedAt: savedOrder.completedAt,
    });

    // Create completion notification
    try {
      const userId = order.user.userId.toString();
      await createOrderCompletedNotification(userId, orderId);
      console.log(`✅ Completion notification created for user ${userId}`);
    } catch (notificationError) {
      console.error(
        "❌ Error creating completion notification:",
        notificationError
      );
    }

    // Update stock quantities (using actual quantities)
    try {
      await updateItemQuantities(savedOrder.items, "increase");
      console.log("✅ Restocked item quantities for completed order (actual quantities).");
    } catch (restockError) {
      console.error("❌ Failed to restock items:", restockError);
      return res.status(400).json({
        message: "Order completed but failed to restock items",
      });
    }

    // Populate and return response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate("courier", "name phoneNumber email imgUrl")
      .populate("user.userId", "name phoneNumber email imgUrl");

    res.status(200).json({
      message: "Order completed successfully by admin with points awarded based on actual quantities",
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        deliveryProof: populatedOrder.deliveryProof,
        collectedAt: populatedOrder.collectedAt,
        completedAt: populatedOrder.completedAt,
        estimatedWeight: populatedOrder.estimatedWeight,
        quantityAdjustmentNotes: populatedOrder.quantityAdjustmentNotes,
        createdAt: populatedOrder.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Complete order from collected error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// NEW: Get collected orders for admin to complete
export const getCollectedOrdersForAdmin = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find({ status: "collected" })
      .populate("user.userId", "name phoneNumber email imgUrl")
      .populate("courier", "name phoneNumber email imgUrl")
      .sort({ collectedAt: -1 }) // Sort by collection time
      .skip(skip)
      .limit(Number(limit));

    const totalOrders = await Order.countDocuments({ status: "collected" });
    const totalPages = Math.ceil(totalOrders / Number(limit));

    res.status(200).json({
      success: true,
      message: "Collected orders retrieved successfully",
      count: orders.length,
      totalOrders,
      totalPages,
      currentPage: Number(page),
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get collected orders error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Keep the original function name for backward compatibility but point to markOrderAsCollected
export const completeOrderWithProof = markOrderAsCollected;