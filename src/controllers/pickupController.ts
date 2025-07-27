import express from "express";
import mongoose from 'mongoose';
import Order, { IOrder, IItem, IStatusHistory } from '../models/pickupOrder'; // Use the comprehensive schema
import Category from '../models/category';
import User from '../models/users';
import { 
  createOrderAssignedNotification, 
  createOrderCancelledNotification, 
  createOrderCompletedNotification,
  createOrderStatusChangeNotification 
} from '../services/notificationService';

// Use interfaces from pickupOrder.ts
interface IAuthenticatedRequest extends express.Request {
  user: {
    userId: string;
    role: string;
    userName?: string;
    email?: string;
  };
}

const calculateOrderPoints = (items: IItem[]): number => {
  return items.reduce((total, item) => total + (item.points * item.quantity), 0);
};

export const createOrder = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { address, items, phoneNumber, userName, imageUrl, email } = req.body;
    console.log("🔍 Incoming order request:", req.body);

    // Validate required fields
    if (!address || !items || !phoneNumber || !userName) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, phoneNumber, userName"
      });
      return;
    }

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
        email
      },
      address,
      items: enrichedItems,
      status: 'pending' // Use the enum value from pickupOrder schema
    });
    
    const savedOrder = await newOrder.save();
    
    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: savedOrder
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getAllOrders = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ 'user.userId': userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteOrderById = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
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
        message: "Invalid order ID format"
      });
      return;
    }

    const orderToDelete = await Order.findById(orderId) as IOrder | null;
    if (!orderToDelete) {
      console.warn("❌ Order not found:", orderId);
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    let deletedOrder;
    let shouldRemovePoints = false;

    if (userRole === "admin") {
      console.log("🛡️ Admin attempting to delete order...");
      
      if (orderToDelete.status === 'completed') {
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
          message: "You do not have permission to delete this order"
        });
        return;
      }

      if (orderToDelete.status === 'completed') {
        shouldRemovePoints = true;
        console.log("⚠️ Order was completed, will remove points from user");
      }

      deletedOrder = await Order.findOneAndDelete({
        _id: orderId,
        'user.userId': userId
      });
    }

    if (!deletedOrder) {
      console.warn("❌ Order not found or already deleted:", orderId);
      res.status(404).json({
        success: false,
        message: "Order not found or already deleted"
      });
      return;
    }

    // Remove points if the order was completed
    if (shouldRemovePoints) {
      try {
        const pointsToRemove = calculateOrderPoints(deletedOrder.items);
        const orderUserId = deletedOrder.user.userId;

        console.log(`🔄 Removing ${pointsToRemove} points from user ${orderUserId}`);

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
            type: 'deducted',
            reason: `Order deleted - Points refund`,
            timestamp: new Date()
          });

          await user.save();
          
          console.log(`✅ Removed ${pointsToRemove} points from user ${orderUserId}. New total: ${user.totalPoints}`);
        } else {
          console.warn(`⚠️ User ${orderUserId} not found when trying to remove points`);
        }
      } catch (pointsError) {
        console.error('❌ Error removing points from user:', pointsError);
      }
    }

    console.log("✅ Order deleted successfully:", deletedOrder._id);
    res.json({
      success: true,
      message: "Order deleted successfully",
      data: {
        ...deletedOrder.toObject(),
        pointsRemoved: shouldRemovePoints ? calculateOrderPoints(deletedOrder.items) : 0
      }
    });

  } catch (error) {
    console.error("🔥 Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteAllOrders = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    
    const result = await Order.deleteMany({ 'user.userId': userId });
    
    res.json({
      success: true,
      message: `${result.deletedCount} orders deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting all orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getOrderById = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    
    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    });
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or access denied"
      });
      return;
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getOrdersByStatus = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const status = req.params.status;
    
    const orders = await Order.find({
      'user.userId': userId,
      status: status
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("Error fetching orders by status:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateOrderStatus = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { status, reason, notes } = req.body;
    
    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required"
      });
      return;
    }

    const validStatuses = ['pending', 'assigntocourier', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
      return;
    }
    
    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    }) as IOrder | null;
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or you don't have permission to update it"
      });
      return;
    }

    // Update status and add to history
    order.status = status;
    
    const statusHistoryEntry: IStatusHistory = {
      status: status,
      timestamp: new Date(),
      updatedBy: req.user.userName || req.user.email || userId,
      ...(status === 'cancelled' && reason && { reason }),
      ...(notes && { notes })
    };

    order.statusHistory.push(statusHistoryEntry);
    
    const updatedOrder = await order.save();
    
    res.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getAllOrdersForAdmin = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Admin - Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const cancelOrder = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { reason, notes } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    }) as IOrder | null;

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or access denied"
      });
      return;
    }

    if (order.status === 'assigntocourier') {
      res.status(400).json({
        success: false,
        message: "Cannot cancel an order that is already assigned to courier"
      });
      return;
    }

    if (order.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: "Order is already cancelled"
      });
      return;
    }

    order.status = 'cancelled';
    
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      updatedBy: req.user.userName || req.user.email || userId,
      reason: reason || 'Order cancelled by customer',
      notes: notes || undefined
    });

    await order.save();

    res.json({
      success: true,
      message: "Order canceled successfully",
      data: order
    });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateOrderStatusByAdmin = async (req: express.Request, res: express.Response): Promise<void> => {
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

    const validStatuses = ['pending', 'assigntocourier', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
      return;
    }

    const currentOrder = await Order.findById(orderId) as IOrder | null;
    if (!currentOrder) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (status === 'cancelled' && !reason) {
      res.status(400).json({
        success: false,
        message: "Cancellation reason is required when cancelling an order",
      });
      return;
    }

    const previousStatus = currentOrder.status;
    currentOrder.status = status;
    
    const statusHistoryEntry: IStatusHistory = {
      status: status,
      timestamp: new Date(),
      updatedBy: 'admin',
      ...(status === 'cancelled' && reason && { reason }),
      ...(notes && { notes })
    };

    currentOrder.statusHistory.push(statusHistoryEntry);
    const updatedOrder = await currentOrder.save();

    // Create notifications based on status change
    const userId = currentOrder.user.userId.toString();
    
    try {
      if (status === 'assigntocourier' && previousStatus !== 'assigntocourier') {
        await createOrderAssignedNotification(userId, orderId);
      } else if (status === 'cancelled' && previousStatus !== 'cancelled') {
        await createOrderCancelledNotification(userId, orderId, reason || 'No reason provided');
      } else if (status === 'completed' && previousStatus !== 'completed') {
        await createOrderCompletedNotification(userId, orderId);
      } else if (previousStatus !== status) {
        await createOrderStatusChangeNotification(userId, orderId, previousStatus, status);
      }
    } catch (notificationError) {
      console.error('❌ Error creating notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // If order is being marked as completed, add points to user
    if (status === 'completed' && previousStatus !== 'completed') {
      try {
        const totalPoints = calculateOrderPoints(updatedOrder.items);
        
        const user = await User.findById(currentOrder.user.userId);
        if (user) {
          user.totalPoints = (user.totalPoints || 0) + totalPoints;
          
          if (!user.pointsHistory) {
            user.pointsHistory = [];
          }
          
          user.pointsHistory.push({
            orderId: orderId,
            points: totalPoints,
            type: 'earned',
            reason: `Order completed - Recycling items`,
            timestamp: new Date()
          });

          await user.save();
          
          console.log(`✅ Added ${totalPoints} points to user ${user._id} for completed order ${orderId}`);
        }
      } catch (pointsError) {
        console.error('❌ Error adding points to user:', pointsError);
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
export const getOrderAnalyticsWithPoints = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Calculate total points distributed
    const pointsData = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalPointsDistributed: { $sum: { $multiply: ["$items.points", "$items.quantity"] } },
          totalItemsRecycled: { $sum: "$items.quantity" }
        }
      }
    ]);

    const dailyOrdersRaw = await Order.aggregate([
      {
        $group: {
          _id: {
            day: { $dayOfWeek: { date: "$createdAt", timezone: "Africa/Cairo" } }
          },
          count: { $sum: 1 },
        }
      }
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
          averagePointsPerOrder: completedOrders > 0 ? Math.round((pointsData[0]?.totalPointsDistributed || 0) / completedOrders) : 0
        }
      }
    });
  } catch (error) {
    console.error("Error getting order analytics with points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getOrderAnalytics = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const pointsData = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalPointsDistributed: { $sum: { $multiply: ["$items.points", "$items.quantity"] } },
          totalItemsRecycled: { $sum: "$items.quantity" }
        }
      }
    ]);

    const dailyOrdersRaw = await Order.aggregate([
      {
        $group: {
          _id: {
            day: { $dayOfWeek: { date: "$createdAt", timezone: "Africa/Cairo" } }
          },
          count: { $sum: 1 },
        }
      }
    ]);

    const dailyOrders = Array(7).fill(0);
    for (const item of dailyOrdersRaw) {
      const dayIndex = item._id.day === 1 ? 6 : item._id.day - 2;
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
          averagePointsPerOrder: completedOrders > 0 ? Math.round((pointsData[0]?.totalPointsDistributed || 0) / completedOrders) : 0
        }
      }
    });
  } catch (error) {
    console.error("Error getting order analytics:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getTopMaterialsRecycled = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const category = req.query.category as string | undefined;

    const pipeline: any[] = [
      { $unwind: "$items" },
    ];

    if (category) {
      pipeline.push({ $match: { "items.categoryName": category } });
    }

    pipeline.push(
      {
        $group: {
          _id: { itemName: "$items.itemName", categoryName: "$items.categoryName" },
          totalQuantity: { $sum: "$items.quantity" },
          totalPoints: { $sum: "$items.points" },
          image: { $first: "$items.image" },
          categoryName: { $first: "$items.categoryName" },
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 4 }
    );

    const materials = await Order.aggregate(pipeline);

    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    console.error("Error getting top materials recycled:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}; 

export const getTopCitiesByOrders = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const topCities = await Order.aggregate([
      {
        $group: {
          _id: "$address.city",
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: topCities.map(city => ({
        city: city._id,
        totalOrders: city.totalOrders
      }))
    });
  } catch (error) {
    console.error("Error getting top cities by orders:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const recalculateUserPointsFromOrders = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const completedOrders = await Order.find({
      'user.userId': userId,
      status: 'completed'
    });

    let totalPointsFromOrders = 0;
    const pointsHistory: any[] = [];

    completedOrders.forEach(order => {
      const orderPoints = calculateOrderPoints(order.items);
      totalPointsFromOrders += orderPoints;
      
      pointsHistory.push({
        orderId: order._id,
        points: orderPoints,
        type: 'earned',
        reason: `Order completed - Recycling items`,
        timestamp: order.createdAt
      });
    });

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    const oldPoints = user.totalPoints || 0;
    user.totalPoints = totalPointsFromOrders;
    user.pointsHistory = pointsHistory;
    
    if (oldPoints !== totalPointsFromOrders) {
      user.pointsHistory.push({
        points: totalPointsFromOrders - oldPoints,
        type: 'adjusted',
        reason: 'Points recalculated from completed orders',
        timestamp: new Date()
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
        adjustment: totalPointsFromOrders - oldPoints
      }
    });
  } catch (error) {
    console.error("Error recalculating user points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const getUserOrdersWithPoints = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ 'user.userId': userId })
      .sort({ createdAt: -1 });
    
    const ordersWithPoints = orders.map(order => ({
      ...order.toObject(),
      pointsEarned: order.status === 'completed' ? calculateOrderPoints(order.items) : 0,
      potentialPoints: calculateOrderPoints(order.items)
    }));
    
    res.json({
      success: true,
      count: ordersWithPoints.length,
      data: ordersWithPoints
    });
  } catch (error) {
    console.error("Error fetching user orders with points:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};