import express from "express";
import mongoose, { Document, Schema, Model } from 'mongoose';

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
}

interface IItem {
  name?: string;
  quantity?: number;
  totalPoints?: number;
  TotalMoney?: number;
}

interface IOrder extends Document {
  user: IUser;
  address: IAddress;
  items: IItem[];
  status: string;
  createdAt: Date;
}

// Authenticated user interface for request - matches your middleware
interface IAuthenticatedRequest extends express.Request {
  user: {
    userId: string;
  };
}

// Your existing schemas (keeping them here for completeness)
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
  name: String,
  quantity: Number,
  totalPoints: Number,
  TotalMoney: Number
});

const OrderSchema = new Schema<IOrder>({
  user: {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phoneNumber: String,
    userName: String,
  },
  address: AddressSchema, 
  items: [ItemSchema],
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});

// Add index for better query performance
OrderSchema.index({ 'user.userId': 1, createdAt: -1 });

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

// UPDATED CONTROLLER FUNCTIONS

// Create order - automatically assigns to authenticated user
export const createOrder = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const { address, items, phoneNumber, userName } = req.body;
    
    // Validate required fields
    if (!address || !items || !phoneNumber || !userName) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: address, items, phoneNumber, userName"
      });
      return;
    }

    const newOrder = new Order({
      user: {
        userId,
        phoneNumber,
        userName
      },
      address,
      items,
      status: 'Pending'
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

// Delete order by ID - ONLY if it belongs to the authenticated user
export const deleteOrderById = async (req: IAuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;
    
    // Only delete if the order belongs to the authenticated user
    const deletedOrder = await Order.findOneAndDelete({
      _id: orderId,
      'user.userId': userId
    });
    
    if (!deletedOrder) {
      res.status(404).json({
        success: false,
        message: "Order not found or you don't have permission to delete it"
      });
      return;
    }
    
    res.json({
      success: true,
      message: "Order deleted successfully",
      data: deletedOrder
    });
  } catch (error) {
    console.error("Error deleting order:", error);
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

// Get orders by status - for authenticated user only
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