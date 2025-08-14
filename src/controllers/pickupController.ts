import express from "express";
import mongoose from "mongoose";
import Order, { IOrder, IItem, IStatusHistory } from "../models/pickupOrder"; // Use the comprehensive schema
import Category from "../models/category";
import User from "../models/users";
import Cart from "../models/cart";
import {
  createOrderAssignedNotification,
  createOrderCancelledNotification,
  createOrderCompletedNotification,
  createOrderStatusChangeNotification,
} from "../services/notificationService";
import {
  mapCartItemsToOrderItems,
  updateItemQuantities,
} from "../utils/stockHelper";
import { runAggregation } from "../utils/FilterHelper";
import { processUserPoints } from "../utils/tireHelpe";
import { getSocketIO } from "../socket/socketServer";
import { TranslationService } from "../services/translationService";
import translation from "../models/translation";

// Use interfaces from pickupOrder.ts
export interface IAuthenticatedRequest extends express.Request {
  user: {
    userId: string;
    role: string;
    userName?: string;
    email?: string;
  };
}

export const calculateOrderPoints = (items: IItem[]): number => {
  return items.reduce((total, item) => total + item.points * item.quantity, 0);
};

export const createOrder = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const {
      address,
      items,
      phoneNumber,
      userName,
      imageUrl,
      email,
      paymentMethod,
      deliveryFee,
      totalAmount,
    } = req.body;
    console.log("🔍 Incoming order request:", req.body);

    console.log("--------------INSIDE CREATE ORDER-------------");
    console.log("--------------Incoming Items-------------");
    console.log(items);
    console.log("--------------Mapping Items-------------");
    const newOrderItems = mapCartItemsToOrderItems(items);
    console.log(newOrderItems);
    console.log("--------------End Display Items-------------");

    if (!address || !items || !phoneNumber || !userName) {
      res.status(400).json({
        success: false,
        message:
          "Missing required fields: address, items, phoneNumber, userName",
      });
      return;
    }

    // 🔍 Fetch user and check role
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // 🛒 If buyer, update item quantities

    // 🧠 Enrich items with category names
    const enrichedItems = await Promise.all(
      items.map(async (item: IItem) => {
        const category = await Category.findById(item.categoryId);
        return {
          ...item,
          categoryName: category ? category.name : undefined,
        };
      })
    );

    const newOrder = new Order({
      user: {
        userId: new mongoose.Types.ObjectId(userId),
        phoneNumber,
        userName,
        email,
      },
      address,
      items: newOrderItems,
      status: "pending",
      paymentMethod,
      deliveryFee,
      totalAmount,
    });

    const savedOrder = await newOrder.save();
    console.log("kkkkkkkkkkkkkkkk");
    console.log(savedOrder.items);

    if (user.role === "buyer") {
      await updateItemQuantities(savedOrder.items, "decrease");
    }

    // 🛒 Clear the cart items array for this user after order creation
    try {
      const userCart = await Cart.findOne({ userId });
      if (userCart) {
        userCart.items = [];
        await userCart.save();
        console.log("✅ Cart items cleared for user:", userId);
      } else {
        console.log("ℹ️ No cart found for user:", userId);
      }
    } catch (cartClearError) {
      console.error("❌ Error clearing cart items:", cartClearError);
      // Do not fail the order creation if cart clearing fails
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: savedOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllOrders = async (
  req: IAuthenticatedRequest & { language?: 'en' | 'ar' },
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';

    let filter: any = { "user.userId": userId };
    if (status) {
      if (status === "incoming") filter.status = { $in: ["pending", "assigntocourier", "collected"] };
      else if (status === "completed") filter.status = "completed";
      else if (status === "cancelled") filter.status = "cancelled";
      else if (status === "collected") filter.status = "collected";
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalCompletedOrders = await Order.countDocuments({
      "user.userId": userId,
      status: "completed",
    });

    const orders = await Order.find(filter)
      .populate({
        path: "courier",
        select: "name email phoneNumber rating totalReviews",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Map orders with review info
    let ordersWithReviewData = orders.map((order) => {
      const orderObj: any = order.toObject();

      if (orderObj.courier) {
        orderObj.courier = {
          _id: orderObj.courier._id,
          email: orderObj.courier.email,
          phoneNumber: orderObj.courier.phoneNumber,
          name: orderObj.courier.name || "Unknown Courier",
          rating: orderObj.courier.rating,
          totalReviews: orderObj.courier.totalReviews,
        };
      }

      if (order.status === "completed") {
        if (order.deliveryReview) {
          orderObj.review = {
            _id: order._id.toString(),
            orderId: order._id.toString(),
            stars: order.deliveryReview.stars,
            comment: order.deliveryReview.comment,
            reviewedAt: order.deliveryReview.reviewedAt,
            courier: {
              id: (order.courier as any)?._id?.toString() || order.deliveryReview.reviewedBy.toString(),
              name: (order.courier as any)?.name || "Unknown Courier",
            },
            hasReview: true,
          };
          orderObj.canBeReviewed = false;
          orderObj.hasReview = true;
        } else {
          orderObj.canBeReviewed = true;
          orderObj.hasReview = false;
        }
      } else {
        orderObj.canBeReviewed = false;
        orderObj.hasReview = false;
      }

      return orderObj;
    });

    // If Arabic is requested, translate order items and category names
    if (language === 'ar' && ordersWithReviewData.length > 0) {
      try {
        ordersWithReviewData = await TranslationService.translateOrders(ordersWithReviewData, language);
      } catch (translationError) {
        console.error('Order translation failed:', translationError);
        // fallback to original orders
      }
    }

    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      success: true,
      count: ordersWithReviewData.length,
      totalCount: totalOrders,
      totalCompletedOrders,
      data: ordersWithReviewData,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteOrderById = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const orderId = req.params.id;

    console.log("🔍 Incoming Delete Request");
    console.log("🧑 User ID:", userId);
    console.log("🔐 User Role:", userRole);
    console.log("📦 Order ID:", orderId);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.warn("❌ Invalid Order ID format:", orderId);
      res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
      return;
    }

    const orderToDelete = (await Order.findById(orderId)) as IOrder | null;
    if (!orderToDelete) {
      console.warn("❌ Order not found:", orderId);
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    let deletedOrder;
    let shouldRemovePoints = false;

    if (userRole === "admin") {
      console.log("🛡️ Admin attempting to delete order...");

      if (orderToDelete.status === "completed") {
        shouldRemovePoints = true;
        console.log("⚠️ Order was completed, will remove points from user");
      }

      deletedOrder = await Order.findByIdAndDelete(orderId);
    } else {
      console.log("👤 Customer attempting to delete their own order...");

      const ownerId = orderToDelete.user?.userId?.toString();
      console.log("👤 Order Owner ID:", ownerId);

      if (ownerId !== userId) {
        console.warn("🚫 Permission denied. User does not own the order.");
        res.status(403).json({
          success: false,
          message: "You do not have permission to delete this order",
        });
        return;
      }

      if (orderToDelete.status === "completed") {
        shouldRemovePoints = true;
        console.log("⚠️ Order was completed, will remove points from user");
      }

      deletedOrder = await Order.findOneAndDelete({
        _id: orderId,
        "user.userId": userId,
      });
    }

    if (!deletedOrder) {
      console.warn("❌ Order not found or already deleted:", orderId);
      res.status(404).json({
        success: false,
        message: "Order not found or already deleted",
      });
      return;
    }

    // Remove points if the order was completed
    if (shouldRemovePoints) {
      try {
        const pointsToRemove = calculateOrderPoints(deletedOrder.items);
        const orderUserId = deletedOrder.user.userId;

        console.log(
          `🔄 Removing ${pointsToRemove} points from user ${orderUserId}`
        );

        const user = await User.findById(orderUserId);
        if (user) {
          const currentPoints = user.totalPoints || 0;
          user.totalPoints = Math.max(0, currentPoints - pointsToRemove);

          if (!user.pointsHistory) {
            user.pointsHistory = [];
          }

          user.pointsHistory.push({
            orderId: orderId,
            points: -pointsToRemove,
            type: "deducted",
            reason: `Order deleted - Points refund`,
            timestamp: new Date(),
          });

          await user.save();

          console.log(
            `✅ Removed ${pointsToRemove} points from user ${orderUserId}. New total: ${user.totalPoints}`
          );
        } else {
          console.warn(
            `⚠️ User ${orderUserId} not found when trying to remove points`
          );
        }
      } catch (pointsError) {
        console.error("❌ Error removing points from user:", pointsError);
      }
    }

    console.log("✅ Order deleted successfully:", deletedOrder._id);
    res.json({
      success: true,
      message: "Order deleted successfully",
      data: {
        ...deletedOrder.toObject(),
        pointsRemoved: shouldRemovePoints
          ? calculateOrderPoints(deletedOrder.items)
          : 0,
      },
    });
  } catch (error) {
    console.error("🔥 Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteAllOrders = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;

    const result = await Order.deleteMany({ "user.userId": userId });

    res.json({
      success: true,
      message: `${result.deletedCount} orders deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting all orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getOrderById = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
      return;
    }

    // Use aggregation to get order with courier details
    const orderResult = await Order.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(orderId),
          "user.userId": new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user.userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "courier",
          foreignField: "_id",
          as: "courierDetails",
          pipeline: [
            {
              $project: {
                attachments: 1,
                name: 1,
                email: 1,
                phoneNumber: 1,
                rating: 1,
                totalReviews: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          "user.role": { $arrayElemAt: ["$userDetails.role", 0] },
          "user.name": { $arrayElemAt: ["$userDetails.name", 0] },
          "user.email": { $arrayElemAt: ["$userDetails.email", 0] },
          courier: { $arrayElemAt: ["$courierDetails", 0] },
        },
      },
      {
        $project: {
          userDetails: 0,
          courierDetails: 0,
        },
      },
    ]);

    if (!orderResult || orderResult.length === 0) {
      res.status(404).json({
        success: false,
        message: "Order not found or access denied",
      });
      return;
    }

    const order = orderResult[0];

    // Add review information for completed orders (similar to getAllOrders)
    if (order.status === "completed") {
      if (order.deliveryReview) {
        // Order has a review
        order.review = {
          _id: order._id.toString(),
          orderId: order._id.toString(),
          stars: order.deliveryReview.stars,
          comment: order.deliveryReview.comment,
          reviewedAt: order.deliveryReview.reviewedAt,
          courier: {
            id:
              order.courier?._id?.toString() ||
              order.deliveryReview.reviewedBy.toString(),
            name: order.courier?.name || "Unknown Courier",
          },
          hasReview: true,
        };
        order.canBeReviewed = false;
        order.hasReview = true;
      } else {
        // Order can be reviewed
        order.canBeReviewed = true;
        order.hasReview = false;
      }
    } else {
      // Non-completed orders cannot be reviewed
      order.canBeReviewed = false;
      order.hasReview = false;
    }

    // Normalize courier data to ensure consistent field names (if courier exists)
    if (order.courier) {
      order.courier = {
        _id: order.courier._id,
        email: order.courier.email,
        phoneNumber: order.courier.phoneNumber,
        name: order.courier.name || "Unknown Courier",
        rating: order.courier.rating,
        totalReviews: order.courier.totalReviews,
        attachments: order.courier.attachments,
      };
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getOrdersByStatus = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const status = req.params.status;

    const orders = await Order.find({
      "user.userId": userId,
      status: status,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders by status:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateOrderStatus = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { status, reason, notes } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required",
      });
      return;
    }

    const validStatuses = [
      "pending",
      "assigntocourier",
      "collected",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
      return;
    }

    const order = (await Order.findOne({
      _id: orderId,
      "user.userId": userId,
    })) as IOrder | null;

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or you don't have permission to update it",
      });
      return;
    }

    // Update status and add to history
    order.status = status;

    const statusHistoryEntry: IStatusHistory = {
      status: status,
      timestamp: new Date(),
      updatedBy: req.user.userName || req.user.email || userId,
      ...(status === "cancelled" && reason && { reason }),
      ...(notes && { notes }),
    };

    order.statusHistory.push(statusHistoryEntry);

    const updatedOrder = await order.save();

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllOrdersForAdmin = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const date = req.query.date as string;
    const userRole = req.query.userRole as string;
    const search = req.query.search as string; // Add search parameter

    const filters: any = {};

    if (userRole === "customer" || userRole === "buyer") {
      filters["user.role"] = userRole;
    }

    if (status) {
      filters.status = { $in: status.split(",").map((s) => s.trim()) };
    }

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filters.createdAt = { $gte: start, $lt: end };
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filters.$or = [
        { orderId: searchRegex },
        { status: searchRegex },
        { "user.name": searchRegex },
        { "user.email": searchRegex },
      ];
    }

    const lookups = [
      {
        $lookup: {
          from: "users",
          localField: "user.userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "courier",
          foreignField: "_id",
          as: "courierDetails",
          pipeline: [
            { $project: { attachments: 1, name: 1 } }, // only return these fields (+ _id by default)
          ],
        },
      },
    ];

    const addFields = {
      "user.role": { $arrayElemAt: ["$userDetails.role", 0] },
      "user.name": { $arrayElemAt: ["$userDetails.name", 0] },
      "user.email": { $arrayElemAt: ["$userDetails.email", 0] },
      courier: { $arrayElemAt: ["$courierDetails", 0] },
    };

    const project: Record<string, 0 | 1> = {
      userDetails: 0,
      courierDetails: 0,
    };

    const result = await runAggregation(Order, {
      filters,
      lookups,
      addFields,
      project,
      sort: { createdAt: -1 },
      page,
      limit,
    });

    res.json({
      success: true,
      count: result.data.length,
      totalOrders: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      data: result.data,
    });
  } catch (error) {
    console.error("Admin - Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const cancelOrder = async (
  req: IAuthenticatedRequest,
  res: express.Response
): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { reason, notes } = req.body;

    const order = (await Order.findOne({
      _id: orderId,
      "user.userId": userId,
    })) as IOrder | null;

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or access denied",
      });
      return;
    }

    if (order.status === "assigntocourier") {
      res.status(400).json({
        success: false,
        message: "Cannot cancel an order that is already assigned to courier",
      });
      return;
    }

    if (order.status === "cancelled") {
      res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
      return;
    }

    // Calculate points to deduct (same logic as awarding but negative)
    const totalPointsToDeduct = order.items.reduce((sum, item) => {
      return sum + item.points * item.quantity;
    }, 0);

    order.status = "cancelled";

    order.statusHistory.push({
      status: "cancelled",
      timestamp: new Date(),
      updatedBy: req.user.userName || req.user.email || userId,
      reason: reason || "Order cancelled by customer",
      notes: notes || undefined,
    });

    await order.save();

    // Deduct points after order cancellation
    if (totalPointsToDeduct > 0) {
      try {
        await processUserPoints(userId, -totalPointsToDeduct);
        console.log(
          `Deducted ${totalPointsToDeduct} points from user ${userId} due to order cancellation`
        );
      } catch (err) {
        console.error("Failed to deduct points on order cancellation:", err);
      }
    }

    res.json({
      success: true,
      message: "Order canceled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Add this updated function to your existing orderController.ts

// Add this to your existing orderController.ts - updateOrderStatusByAdmin function

export const updateOrderStatusByAdmin = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const orderId = req.params.id;
    const { status, reason, notes } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required",
      });
      return;
    }

    const validStatuses = [
      "pending",
      "assigntocourier",
      "collected",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
      return;
    }

    const currentOrder = (await Order.findById(orderId)) as IOrder | null;
    if (!currentOrder) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (status === "cancelled" && !reason) {
      res.status(400).json({
        success: false,
        message: "Cancellation reason is required when cancelling an order",
      });
      return;
    }

    // Get user role to determine valid transitions
    const user = await User.findById(currentOrder.user.userId);
    const userRole = user?.role || "customer";

    // Define status transitions based on user role
    const getValidTransitions = (role: string): Record<string, string[]> => {
      if (role === "buyer") {
        return {
          pending: ["assigntocourier", "cancelled"],
          assigntocourier: ["completed", "cancelled", "pending"], // ADD "pending" here for courier revocation
          collected: ["completed", "cancelled"],
          completed: [],
          cancelled: [],
        };
      } else {
        return {
          pending: ["assigntocourier", "cancelled"],
          assigntocourier: ["collected", "cancelled", "pending"], // ADD "pending" here for courier revocation
          collected: ["completed", "cancelled"],
          completed: [],
          cancelled: [],
        };
      }
    };

    const validTransitions = getValidTransitions(userRole);
    const currentStatus = currentOrder.status.toLowerCase();

    if (!validTransitions[currentStatus]?.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentStatus} to ${status} for ${userRole}`,
      });
      return;
    }

    const previousStatus = currentOrder.status;
    currentOrder.status = status;

    const statusHistoryEntry: IStatusHistory = {
      status: status,
      timestamp: new Date(),
      updatedBy: "admin",
      ...(status === "cancelled" && reason && { reason }),
      ...(notes && { notes }),
    };

    currentOrder.statusHistory.push(statusHistoryEntry);
    const updatedOrder = await currentOrder.save();

    // Create notifications based on status change
    const userId = currentOrder.user.userId.toString();

    try {
      if (
        status === "assigntocourier" &&
        previousStatus !== "assigntocourier"
      ) {
        await createOrderAssignedNotification(userId, orderId);
      } else if (status === "cancelled" && previousStatus !== "cancelled") {
        await createOrderCancelledNotification(
          userId,
          orderId,
          reason || "No reason provided"
        );
      } else if (status === "completed" && previousStatus !== "completed") {
        await createOrderCompletedNotification(userId, orderId);
      } else if (previousStatus !== status) {
        await createOrderStatusChangeNotification(
          userId,
          orderId,
          previousStatus,
          status
        );
      }
    } catch (notificationError) {
      console.error("❌ Error creating notification:", notificationError);
    }

    // Award points and update stock when order is completed
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const totalPoints = calculateOrderPoints(updatedOrder.items);

        if (user && totalPoints > 0) {
          const { newTotalPoints, bonusPointsAdded } = await processUserPoints(
            user._id.toString(),
            totalPoints
          );

          user.pointsHistory.push({
            orderId: orderId,
            points: newTotalPoints,
            type: "earned",
            reason: `Order completed by admin - ${userRole} order`,
            timestamp: new Date(),
          });

          user.totalPoints = newTotalPoints;
          await user.save();

          console.log(
            `✅ Added ${totalPoints} points to ${userRole} ${user._id} for completed order ${orderId}`
          );
        }

        // 🎯 ADD STOCK UPDATE HERE - This was missing!
        await updateItemQuantities(updatedOrder.items, "increase");
        console.log("✅ Restocked item quantities for admin-completed order.");
      } catch (pointsError) {
        console.error("❌ Error adding points or updating stock:", pointsError);
        // Don't fail the entire operation, but log the error
        res.status(200).json({
          success: true,
          message: `Order status updated to ${status} successfully, but there was an issue with points/stock update`,
          data: updatedOrder,
        });
        return;
      }
    }

    res.json({
      success: true,
      message: `Order status updated to ${status} successfully`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Admin - Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getOrderAnalyticsWithPoints = async (
  _req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: "completed" });

    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Calculate total points distributed
    const pointsData = await Order.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalPointsDistributed: {
            $sum: { $multiply: ["$items.points", "$items.quantity"] },
          },
          totalItemsRecycled: { $sum: "$items.quantity" },
        },
      },
    ]);

    const dailyOrdersRaw = await Order.aggregate([
      {
        $group: {
          _id: {
            day: {
              $dayOfWeek: { date: "$createdAt", timezone: "Africa/Cairo" },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const dailyOrders = Array(7).fill(0);
    for (const item of dailyOrdersRaw) {
      const dayIndex = item._id.day - 1;
      dailyOrders[dayIndex] = item.count;
    }

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        statusCounts: statusCounts.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {} as Record<string, number>),
        dailyOrders,
        pointsAnalytics: {
          totalPointsDistributed: pointsData[0]?.totalPointsDistributed || 0,
          totalItemsRecycled: pointsData[0]?.totalItemsRecycled || 0,
          averagePointsPerOrder:
            completedOrders > 0
              ? Math.round(
                  (pointsData[0]?.totalPointsDistributed || 0) / completedOrders
                )
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error getting order analytics with points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getOrderAnalytics = async (
  _req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    // Get current week's start and end dates in Egypt timezone
    const getCurrentWeekBounds = () => {
      const now = new Date();
      // Convert to Egypt timezone
      const egyptNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Africa/Cairo" })
      );

      // Get current day of week (0 = Sunday, 1 = Monday, etc.)
      const currentDay = egyptNow.getDay();

      // Calculate days since Monday (Monday = 0, Tuesday = 1, etc.)
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

      // Get Monday of current week
      const startOfWeek = new Date(egyptNow);
      startOfWeek.setDate(egyptNow.getDate() - daysSinceMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      // Get Sunday of current week (end of week)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Convert back to UTC for MongoDB query
      const startOfWeekUTC = new Date(startOfWeek.toISOString());
      const endOfWeekUTC = new Date(endOfWeek.toISOString());

      console.log("Current week bounds:");
      console.log("Egypt Now:", egyptNow);
      console.log("Start of week (Egypt):", startOfWeek);
      console.log("End of week (Egypt):", endOfWeek);
      console.log("Start of week (UTC):", startOfWeekUTC);
      console.log("End of week (UTC):", endOfWeekUTC);

      return { startOfWeekUTC, endOfWeekUTC };
    };

    const { startOfWeekUTC, endOfWeekUTC } = getCurrentWeekBounds();

    // Current week filter
    const currentWeekFilter = {
      createdAt: {
        $gte: startOfWeekUTC,
        $lte: endOfWeekUTC,
      },
    };

    // Total orders (all time for overall stats)
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: "completed" });

    // Status counts (all time)
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Points data (all time for overall analytics)
    const pointsData = await Order.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalPointsDistributed: {
            $sum: { $multiply: ["$items.points", "$items.quantity"] },
          },
          totalItemsRecycled: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Daily orders for CURRENT WEEK ONLY
    const dailyOrdersRaw = await Order.aggregate([
      {
        $match: currentWeekFilter, // Only current week orders
      },
      {
        $group: {
          _id: {
            day: {
              $dayOfWeek: { date: "$createdAt", timezone: "Africa/Cairo" },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("Daily orders raw (current week only):", dailyOrdersRaw);

    // Initialize array for 7 days (Monday = index 0, Sunday = index 6)
    const dailyOrders = Array(7).fill(0);

    for (const item of dailyOrdersRaw) {
      // MongoDB dayOfWeek: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
      // We want: Monday = 0, Tuesday = 1, ..., Sunday = 6
      const mongoDay = item._id.day;
      const arrayIndex = mongoDay === 1 ? 6 : mongoDay - 2; // Sunday becomes 6, Monday becomes 0
      dailyOrders[arrayIndex] = item.count;
    }

    console.log("Processed daily orders array:", dailyOrders);

    // Also get current week's orders for additional debugging
    const currentWeekOrdersCount = await Order.countDocuments(
      currentWeekFilter
    );
    console.log(`Total orders in current week: ${currentWeekOrdersCount}`);

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        statusCounts: statusCounts.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {} as Record<string, number>),
        dailyOrders, // Now only contains current week data
        pointsAnalytics: {
          totalPointsDistributed: pointsData[0]?.totalPointsDistributed || 0,
          totalItemsRecycled: pointsData[0]?.totalItemsRecycled || 0,
          averagePointsPerOrder:
            completedOrders > 0
              ? Math.round(
                  (pointsData[0]?.totalPointsDistributed || 0) / completedOrders
                )
              : 0,
        },
        // Add debug info
        debug: {
          currentWeekBounds: {
            start: startOfWeekUTC,
            end: endOfWeekUTC,
          },
          currentWeekOrdersCount,
          dailyOrdersRaw,
        },
      },
    });
  } catch (error) {
    console.error("Error getting order analytics:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getTopMaterialsRecycled = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const category = req.query.category as string | undefined;
    const language = (req.query.language as 'en' | 'ar') || 'en';

    // 1. Aggregation Pipeline
    const pipeline: any[] = [
      { $unwind: "$items" },
      {
        $addFields: {
          "items.quantity": { $toDouble: "$items.quantity" },
          "items.points": { $toDouble: "$items.points" },
          // Normalize item names with manual Arabic handling
          "items.normalizedItemName": {
            $toLower: {
              $switch: {
                branches: [
                  { case: { $eq: ["$items.itemName", "اكريلك"] }, then: "acrylic" }
                ],
                default: "$items.itemName"
              }
            }
          }
        }
      }
    ];

    if (category) {
      pipeline.push({ $match: { "items.categoryName": category } });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            itemName: "$items.normalizedItemName",
          },
          totalQuantity: { $sum: "$items.quantity" },
          totalPoints: { $sum: "$items.points" },
          image: { $first: "$items.image" },
          // Apply initial translation during grouping
          itemName: {
            $first: {
              $switch: {
                branches: [
                  { case: { $eq: ["$items.itemName", "اكريلك"] }, then: "Acrylic" }
                ],
                default: "$items.itemName"
              }
            }
          },
          categoryNames: { $addToSet: "$items.categoryName" },
          unit: { $first: "$items.unit" },
          documentCount: { $sum: 1 },
          nameVariations: { $addToSet: "$items.itemName" },
          unitVariations: { $addToSet: "$items.unit" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 4 }
    );

    // 2. Execute Aggregation
    let materials = await Order.aggregate(pipeline);

    // 3. Enhanced Translation Handling
    if (materials.length > 0) {
      // Get all text needing translation
      const translationTexts = [
        ...new Set([
          ...materials.flatMap(m => [m.itemName, ...m.nameVariations]),
          ...materials.flatMap(m => m.categoryNames)
        ])
      ];

      // Find all translations in single query
      const translations = await translation.find({
        $or: [
          { key: { $in: translationTexts.map(t => `item_${t}`) } },
          { "translations.ar": { $in: translationTexts } },
          { key: { $in: translationTexts.map(t => `cat_${t}_name`) } }
        ]
      });

      // Create comprehensive lookup map
      const translationMap = translations.reduce((map, t) => {
        // Map by key
        map[`key::${t.key}`] = t.translations[language] || t.translations.en;
        
        // Map by Arabic text if exists
        if (t.translations.ar) {
          map[`ar::${t.translations.ar}`] = t.translations[language] || t.translations.en;
        }
        
        return map;
      }, {});

      // Manual fallbacks for known items
      const manualFallbacks: Record<string, string> = {
        "اكريلك": "Acrylic",
        "بلاستيك": "Plastic"
      };

      // Apply translations consistently
      materials = materials.map(material => {
        // Translate item name
        const itemTranslation = 
          translationMap[`key::item_${material.itemName}`] ||
          translationMap[`ar::${material.itemName}`] ||
          manualFallbacks[material.itemName] ||
          material.itemName;

        // Translate categories
        const translatedCategories = material.categoryNames.map(cat => {
          return (
            translationMap[`key::cat_${cat}_name`] ||
            translationMap[`ar::${cat}`] ||
            manualFallbacks[cat] ||
            cat
          );
        });

        // Translate name variations
        const translatedVariations = material.nameVariations.map(name => {
          return (
            translationMap[`key::item_${name}`] ||
            translationMap[`ar::${name}`] ||
            manualFallbacks[name] ||
            name
          );
        });

        return {
          ...material,
          _id: {
            itemName: itemTranslation // Ensure _id matches translated name
          },
          itemName: itemTranslation,
          categoryNames: translatedCategories,
          nameVariations: translatedVariations
        };
      });
    }

    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    console.error("Error getting top materials recycled:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
export const getTopCitiesByOrders = async (
  _req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const topCities = await Order.aggregate([
      {
        $group: {
          _id: "$address.city",
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: topCities.map((city) => ({
        city: city._id,
        totalOrders: city.totalOrders,
      })),
    });
  } catch (error) {
    console.error("Error getting top cities by orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const recalculateUserPointsFromOrders = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const completedOrders = await Order.find({
      "user.userId": userId,
      status: "completed",
    });

    let totalPointsFromOrders = 0;
    const pointsHistory: any[] = [];

    completedOrders.forEach((order) => {
      const orderPoints = calculateOrderPoints(order.items);
      totalPointsFromOrders += orderPoints;

      pointsHistory.push({
        orderId: order._id,
        points: orderPoints,
        type: "earned",
        reason: `Order completed - Recycling items`,
        timestamp: order.createdAt,
      });
    });

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const oldPoints = user.totalPoints || 0;
    user.totalPoints = totalPointsFromOrders;
    user.pointsHistory = pointsHistory;

    if (oldPoints !== totalPointsFromOrders) {
      user.pointsHistory.push({
        points: totalPointsFromOrders - oldPoints,
        type: "adjusted",
        reason: "Points recalculated from completed orders",
        timestamp: new Date(),
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "User points recalculated successfully",
      data: {
        userId,
        oldPoints,
        newPoints: totalPointsFromOrders,
        completedOrders: completedOrders.length,
        adjustment: totalPointsFromOrders - oldPoints,
      },
    });
  } catch (error) {
    console.error("Error recalculating user points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};


