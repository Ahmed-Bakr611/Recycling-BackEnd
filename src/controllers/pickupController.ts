import express from "express";
import mongoose, { Document, Schema, Model } from 'mongoose';
import Category from '../models/category'
// Type definitions
interface IAddress {
  city: string;
  area?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault?: boolean;
}

interface IUser {
  userId: mongoose.Types.ObjectId;
  phoneNumber: string;
  userName: string;
  imageUrl?: string; // ✅ add this

}
interface IAuthenticatedRequest extends express.Request {
  user: {
    userId: string;
    role: string;
  };
}

interface IItem {
  categoryId: mongoose.Types.ObjectId;
  image: string;
  itemName: string;
  measurement_unit: 1 | 2;
  points: number;
  price: number;
  quantity: number;
}

interface IOrder extends Document {
  user: IUser;
  address: IAddress;
  items: IItem[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  isConfirmed?: boolean;
  confirmedAt?: Date;
  adminNotes?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  statusHistory?: Array<{
    status: string;
    timestamp: Date;
    updatedBy?: string;
    notes?: string;
  }>;
  emergencyReports?: Array<{
    orderId: any;
    userId: string;
    emergencyType: string;
    description: string;
    location: string;
    reportedAt: Date;
    status: string;
  }>;
  safetyReports?: Array<{
    orderId: any;
    userId: string;
    type: string;
    description: string;
    severity: string;
    reportedAt: Date;
    status: string;
  }>;
}



const AddressSchema = new Schema<IAddress>({
  city: { type: String, required: true },
  area: String,
  street: String,
  building: String,
  floor: String,
  apartment: String,
  landmark: String,
  isDefault: { type: Boolean, default: false },
});


const ItemSchema = new Schema<IItem>({
  categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
  image: String,
  itemName: String,
  measurement_unit: { type: Number, enum: [1, 2] },
  points: Number,
  price: Number,
  quantity: Number,
});

const OrderSchema = new Schema<IOrder>({
  user: {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phoneNumber: String,
    userName: String,
    imageUrl: String,
    email: String      
  },
  address: AddressSchema,
  items: [ItemSchema],
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isConfirmed: { type: Boolean, default: false },
  confirmedAt: { type: Date },
  adminNotes: { type: String },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  cancelledBy: { type: String },
  emergencyReports: [{
    orderId: { type: Schema.Types.ObjectId },
    userId: { type: String, required: true },
    emergencyType: { type: String, required: true },
    description: { type: String },
    location: { type: String },
    reportedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
  }],
  safetyReports: [{
    orderId: { type: Schema.Types.ObjectId },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    reportedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
  }]
});


// Add index for better query performance
OrderSchema.index({ 'user.userId': 1, createdAt: -1 });

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

const calculateOrderPoints = (items: IItem[]): number => {
  return items.reduce((total, item) => total + (item.points * item.quantity), 0);
};



export const createOrder = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { address, items, phoneNumber, userName,imageUrl,email } = req.body;
    console.log("🔍 Incoming order request:", req.body);

    
    // Validate required fields
    if (!address || !items || !phoneNumber || !userName || !imageUrl) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, phoneNumber, userName"
      });
      return;
    }

const enrichedItems = await Promise.all(
  items.map(async (item: IItem) => {
    // Find the category by its ID
    const category = await Category.findById(item.categoryId);
    return {
      ...item,
      categoryName: category ? category.name : null,
    };
  })
);

// Then use enrichedItems in your new order:
const newOrder = new Order({
  user: {
    userId,
    phoneNumber,
    userName,
    imageUrl,
    email
  },
  address,
  items: enrichedItems,  // <--- Use the enriched items here!
  status: 'pending',
  isConfirmed: false
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

// Get all orders - ONLY for the authenticated user
export const getAllOrders = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { id, status, includeCancellation, includeSafetyReports } = req.query;
    
    console.log("🔍 getAllOrders - Query params:", { id, status, includeCancellation, includeSafetyReports });
    console.log("🔍 getAllOrders - User ID:", userId);
    
    let query = Order.find({ 'user.userId': userId });
    
    // Filter by specific order ID if provided
    if (id) {
      query = Order.find({ _id: id, 'user.userId': userId });
    }
    
    // Filter by status if provided
    if (status) {
      query = query.where('status', status);
    }
    
    // Include cancellation data if requested
    if (includeCancellation === 'true') {
      console.log("✅ Including cancellation data");
      query = query.select('+cancellationReason +cancelledAt +cancelledBy');
    }
    
    // Include safety reports if requested
    if (includeSafetyReports === 'true') {
      console.log("✅ Including safety reports");
      // Safety reports are already embedded in the order document
      query = query.select('+safetyReports');
    }
    
    const orders = await query.sort({ createdAt: -1 }).exec(); // Most recent first
    
    console.log("📋 Found orders:", orders.length);
    console.log("📋 Orders with safety reports:", orders.filter(order => order.safetyReports && order.safetyReports.length > 0).length);
    console.log("📋 Orders with cancellation data:", orders.filter(order => order.cancellationReason).length);
    
    // Log sample order data for debugging
    if (orders.length > 0) {
      const sampleOrder = orders[0];
      console.log("📋 Sample order structure:", {
        id: sampleOrder._id,
        status: sampleOrder.status,
        hasSafetyReports: !!sampleOrder.safetyReports,
        safetyReportsCount: sampleOrder.safetyReports?.length || 0,
        hasCancellationReason: !!sampleOrder.cancellationReason,
        cancellationReason: sampleOrder.cancellationReason
      });
    }
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("❌ Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
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

    // First, get the order to check if it was completed and had points awarded
    const orderToDelete = await Order.findById(orderId);
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
      
      // Check if the order was completed (points were awarded)
      if (orderToDelete.status.toLowerCase() === 'completed') {
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

      // Check if the order was completed (points were awarded)
      if (orderToDelete.status.toLowerCase() === 'completed') {
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
          // Remove points from user's total
          const currentPoints = user.totalPoints || 0;
          user.totalPoints = Math.max(0, currentPoints - pointsToRemove); // Ensure points don't go negative
          
          // Add to points history
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
        // Don't fail the order deletion if points removal fails, but log it
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


// Delete all orders - ONLY for the authenticated user
export const deleteAllOrders = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    
    // Only delete orders belonging to the authenticated user
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

// BONUS: Additional useful functions

// Get single order by ID - with user verification
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

// Update order status - only for user's own orders
export const updateOrderStatus = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required"
      });
      return;
    }
    
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        'user.userId': userId
      },
      { status },
      { new: true }
    );
    
    if (!updatedOrder) {
      res.status(404).json({
        success: false,
        message: "Order not found or you don't have permission to update it"
      });
      return;
    }
    
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

    if (order.status === 'assigntocourier') {
      res.status(400).json({
        success: false,
        message: "Cannot cancel an order that is already assigned to a courier"
      });
      return;
    }

    order.status = 'cancelled';
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
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required",
      });
      return;
    }

    // Get the current order before updating
    const currentOrder = await Order.findById(orderId);
    if (!currentOrder) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    // Update the order status
    const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

    // If order is being marked as completed, add points to user
    if (status.toLowerCase() === 'completed' && currentOrder.status.toLowerCase() !== 'completed') {
      try {
        const totalPoints = calculateOrderPoints(updatedOrder!.items);
        
        // Find and update user points
        const user = await User.findById(currentOrder.user.userId);
        if (user) {
          // Add points to user's total
          user.totalPoints = (user.totalPoints || 0) + totalPoints;
          
          // Add to points history
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
        // Don't fail the order status update if points addition fails
      }
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
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

export const getOrderAnalytics = async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const totalOrders = await Order.countDocuments();
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
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
    statusCounts: statusCounts.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {} as Record<string, number>),
    dailyOrders,
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
import { Request, Response } from "express";
import User from "../models/users";

// export const getTopUsersByStoredPoints = async (_req: Request, res: Response): Promise<void> => {
//   try {
//     const topUsers = await User.find({ totalPoints: { $gt: 0 } })
//       .select("name email phoneNumber imageUrl totalPoints")
//       .sort({ totalPoints: -1 })
//       .limit(10);

//     res.json({
//       success: true,
//       data: topUsers.map((user, index) => ({
//         rank: index + 1,
//         userId: user._id,
//         userName: user.name,
//         email: user.email,
//         phoneNumber: user.phoneNumber,
//         totalPoints: user.totalPoints || 0,
//         imageUrl:user.imgUrl
//       }))
//     });
//   } catch (error) {
//     console.error("Error getting top users by stored points:", error);
//     res.status(500).json({
//       success: false,
//       message: error instanceof Error ? error.message : "Unknown error"
//     });
//   }
// };
export const getTopMaterialsRecycled = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.query.category as string | undefined;

    // Build match stage if category is provided
    const matchStage = category ? { "items.categoryName": category } : {};

    const pipeline: any[] = [
      { $unwind: "$items" },
    ];

    // Only filter if category specified
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
      { $limit: 10 } // adjust as needed
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

    // Get all completed orders for this user
    const completedOrders = await Order.find({
      'user.userId': userId,
      status: 'completed'
    });

    // Calculate total points from all completed orders
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

    // Update user with recalculated points
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
    
    // Add adjustment entry if there was a difference
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

// Add function to get user's order history with points earned
export const getUserOrdersWithPoints = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ 'user.userId': userId })
      .sort({ createdAt: -1 });
    
    // Add points calculation to each order
    const ordersWithPoints = orders.map(order => ({
      ...order.toObject(),
      pointsEarned: order.status.toLowerCase() === 'completed' ? calculateOrderPoints(order.items) : 0,
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
}


const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return '#FF9800'; // Orange
    case 'assigntocourier':
      return '#2196F3'; // Blue
    case 'completed':
      return '#4CAF50'; // Green
    case 'cancelled':
      return '#F44336'; // Red
    default:
      return '#9E9E9E'; // Grey
  }
};

export const getOrderTracking = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    
    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    }).select("status createdAt updatedAt");
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found or access denied"
      });
      return;
    }
    
    // Create tracking updates based on order status and timestamps
    const updates = [];
    
    if (order.createdAt) {
      updates.push({
        status: "Order Created",
        timestamp: order.createdAt,
        description: "Your pickup request has been submitted successfully",
        color: "#4CAF50" // Green
      });
    }
    
    if (order.status === "pending") {
      updates.push({
        status: "Pending",
        timestamp: order.updatedAt || order.createdAt,
        description: "Your order is waiting to be assigned to a courier",
        color: "#FF9800" // Orange
      });
    } else if (order.status === "assigntocourier") {
      updates.push({
        status: "Assigned to Courier",
        timestamp: order.updatedAt || order.createdAt,
        description: "A courier has been assigned to your pickup",
        color: "#2196F3" // Blue
      });
    } else if (order.status === "completed") {
      updates.push({
        status: "Completed",
        timestamp: order.updatedAt || order.createdAt,
        description: "Your pickup has been completed successfully",
        color: "#4CAF50" // Green
      });
    } else if (order.status === "cancelled") {
      updates.push({
        status: "Cancelled",
        timestamp: order.updatedAt || order.createdAt,
        description: "Your pickup order has been cancelled",
        color: "#F44336" // Red
      });
    }
    
    res.json({
      success: true,
      data: {
        status: order.status,
        statusColor: getStatusColor(order.status),
        updates: updates,
        driverLocation: null, // Will be implemented when courier tracking is added
      },
    });
  } catch (error) {
    console.error("Error fetching order tracking:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Cancel order with reason
export const cancelOrderWithReason = async (req: IAuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.user.userId;
    const { orderId, reason } = req.body;

    // Validation - Check for required fields
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required"
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or access denied"
      });
    }

    if (order.status === 'assigntocourier') {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an order that is already assigned to a courier"
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed order"
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled"
      });
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();
    
    // Add cancellation reason to order
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.cancelledBy = userId;

    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        orderId: order._id,
        status: order.status,
        reason: order.cancellationReason,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order"
    });
  }
};

// Emergency submit
export const emergencySubmit = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { orderId, emergencyType, description, location } = req.body;

    if (!orderId || !emergencyType) {
      res.status(400).json({
        success: false,
        message: "Order ID and emergency type are required"
      });
      return;
    }

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

    // Create emergency report
    const emergencyReport = {
      orderId: order._id,
      userId: userId,
      emergencyType,
      description: description || '',
      location: location || '',
      reportedAt: new Date(),
      status: 'pending'
    };

    // Add emergency report to order
    if (!order.emergencyReports) {
      order.emergencyReports = [];
    }
    order.emergencyReports.push(emergencyReport);
    order.updatedAt = new Date();

    await order.save();

    res.json({
      success: true,
      message: "Emergency report submitted successfully",
      data: {
        orderId: order._id,
        emergencyReport: emergencyReport
      }
    });
  } catch (error) {
    console.error("Error submitting emergency report:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Safety report submit
export const safetyReportSubmit = async (req: IAuthenticatedRequest, res: express.Response) => {
  try {
    const userId = req.user.userId;
    const { orderId, type, description, severity } = req.body;
    
    console.log("🔍 safetyReportSubmit - Request body:", { orderId, type, description, severity });
    console.log("🔍 safetyReportSubmit - User ID:", userId);
    
    // Validation - Check for required fields
    if (!orderId) {
      console.log("❌ Missing orderId");
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }
    
    if (!type) {
      console.log("❌ Missing type");
      return res.status(400).json({
        success: false,
        message: "Issue type is required"
      });
    }
    
    if (!description) {
      console.log("❌ Missing description");
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }
    
    if (!severity) {
      console.log("❌ Missing severity");
      return res.status(400).json({
        success: false,
        message: "Severity is required"
      });
    }
    
    // Validate severity levels
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      console.log("❌ Invalid severity:", severity);
      return res.status(400).json({
        success: false,
        message: "Invalid severity level. Must be: low, medium, high, or critical"
      });
    }
    
    // Check if order exists and belongs to user
    const order = await Order.findOne({
      _id: orderId,
      'user.userId': userId
    });
    
    if (!order) {
      console.log("❌ Order not found:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found or access denied"
      });
    }
    
    console.log("✅ Order found:", order._id);
    
    // Create safety report
    const safetyReport = {
      orderId: order._id,
      userId: userId,
      type,
      description,
      severity,
      reportedAt: new Date(),
      status: 'pending'
    };

    console.log("📋 Creating safety report:", safetyReport);

    // Add safety report to order
    if (!order.safetyReports) {
      order.safetyReports = [];
    }
    order.safetyReports.push(safetyReport);
    order.updatedAt = new Date();

    const savedOrder = await order.save();
    
    console.log("✅ Safety report saved. Total reports:", savedOrder.safetyReports?.length);
    console.log("✅ Order updated at:", savedOrder.updatedAt);
    
    res.json({
      success: true,
      message: "Safety report submitted successfully",
      data: {
        orderId: order._id,
        safetyReport: safetyReport
      }
    });
    
  } catch (error) {
    console.error("❌ Safety report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit safety report"
    });
  }
};

// Admin order confirmation
export const confirmOrder = async (req: express.Request, res: express.Response) => {
  try {
    const orderId = req.params.id;
    const { adminNotes } = req.body;

    console.log("🔍 confirmOrder - Order ID:", orderId);
    console.log("🔍 confirmOrder - Admin notes:", adminNotes);

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Order not found:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    console.log("✅ Order found:", order._id);
    console.log("📋 Current status:", order.status);

    // Check if order can be confirmed
    if (order.status !== 'pending') {
      console.log("❌ Order cannot be confirmed. Current status:", order.status);
      return res.status(400).json({
        success: false,
        message: `Order cannot be confirmed. Current status: ${order.status}`
      });
    }

    // Update order status
    order.status = 'confirmed';
    order.isConfirmed = true;
    order.confirmedAt = new Date();
    order.adminNotes = adminNotes || '';
    order.updatedAt = new Date();

    const savedOrder = await order.save();

    console.log("✅ Order confirmed successfully");
    console.log("📋 New status:", savedOrder.status);
    console.log("📋 Confirmed at:", savedOrder.confirmedAt);

    res.json({
      success: true,
      data: {
        _id: savedOrder._id,
        status: savedOrder.status,
        isConfirmed: savedOrder.isConfirmed,
        adminNotes: savedOrder.adminNotes,
        confirmedAt: savedOrder.confirmedAt,
        safetyReports: savedOrder.safetyReports || [],
        cancellationReason: savedOrder.cancellationReason,
        cancelledAt: savedOrder.cancelledAt,
        user: savedOrder.user,
        address: savedOrder.address,
        items: savedOrder.items,
        createdAt: savedOrder.createdAt,
        updatedAt: savedOrder.updatedAt
      },
      message: "Order confirmed successfully"
    });

  } catch (error) {
    console.error("❌ Confirm order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm order"
    });
  }
};