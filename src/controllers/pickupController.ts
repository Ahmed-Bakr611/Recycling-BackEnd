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
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});


// Add index for better query performance
OrderSchema.index({ 'user.userId': 1, createdAt: -1 });

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

const calculateOrderPoints = (items: IItem[]): number => {
  return items.reduce((total, item) => total + (item.points * item.quantity), 0);
};
// Create order - automatically assigns to authenticated user
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
  status: 'Pending'
});;
    
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
    
    // Only get orders for the authenticated user
    const orders = await Order.find({ 'user.userId': userId })
      .sort({ createdAt: -1 }); // Most recent first
    
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

    if (order.status === 'InProgress') {
      res.status(400).json({
        success: false,
        message: "Cannot cancel an order that is already in progress"
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
  const dayIndex = item._id.day - 1; // To make Sunday = 0
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