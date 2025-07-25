// controllers/adminController.ts
import multer from 'multer';
import Order from '../models/pickupOrder';
import User from '../models/users';
import { Request, Response } from "express";
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs'
// Define valid order statuses
type OrderStatus = 'pending' | 'assigntocourier' | 'completed' | 'cancelled';

// Interface for status history
interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: Date;
  updatedBy?: string; // Admin/system who made the change
}

// Assign courier to order
export const assignCourierToOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { courierId, status } = req.body;

  try {
    console.log('🚀 Assigning courier to order...');
    console.log('Order ID:', orderId);
    console.log('Courier ID:', courierId);
    console.log('New Status:', status);

    // 1. Validate required fields
    if (!courierId || !status) {
      return res.status(400).json({ 
        message: 'Courier ID and status are required' 
      });
    }

    // 2. Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log('Current Order Status:', order.status);

    // 3. Validate courier exists and has delivery role
    const courier = await User.findById(courierId);
    if (!courier || courier.role !== 'delivery') {
      return res.status(400).json({ 
        message: 'Invalid courier - user not found or not a delivery person' 
      });
    }

    console.log('✅ Courier validated:', courier.name);

    // 4. Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['assigntocourier', 'cancelled'],
      assigntocourier: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const currentStatus = order.status.toLowerCase() as OrderStatus;
    const newStatus = status.toLowerCase() as OrderStatus;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      });
    }

    // 5. Update order with proper ObjectId conversion
    order.courier = new mongoose.Types.ObjectId(courierId);
    order.status = newStatus;

    console.log('Before Save → Order Object:', {
      status: order.status,
      courier: order.courier
    });

    // Initialize statusHistory if it doesn't exist and add current status
    if (!order.statusHistory || order.statusHistory.length === 0) {
      order.statusHistory = [
        {
          status: 'pending',
          timestamp: order.createdAt || new Date(),
          updatedBy: 'system'
        }
      ];
    }
    
    // Add new status to history
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      updatedBy: req.user?.userId || 'admin'
    });

    // Save the order
    const savedOrder = await order.save();
    
    console.log('After Save → Saved Order:', {
      status: savedOrder.status,
      courier: savedOrder.courier
    });

    // 6. Try to populate courier info for response (with error handling)
    let populatedOrder = savedOrder;
    try {
      populatedOrder = await Order.findById(savedOrder._id)
        .populate('courier', 'userName phoneNumber email')
        .populate('user.userId', 'userName phoneNumber email');
      
      console.log('✅ Order populated successfully');
    } catch (populateError) {
      console.warn('⚠️ Population failed, using unpopulated order:', populateError.message);
      // Continue without population
    }

    res.status(200).json({ 
      message: 'Courier assigned successfully', 
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        createdAt: populatedOrder.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Assign courier error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/delivery-proofs';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `delivery-proof-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const uploadProof = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['assigntocourier', 'cancelled'],
      assigntocourier: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const currentStatus = order.status.toLowerCase() as OrderStatus;
    const newStatus = status.toLowerCase() as OrderStatus;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      });
    }

    order.status = newStatus;

    // Add to status history if it exists
    if (order.statusHistory) {
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        updatedBy: req.user?.userId || 'admin'
      });
    }

    await order.save();

    res.status(200).json({ 
      message: 'Order status updated successfully', 
      order 
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all available couriers
export const getAvailableCouriers = async (req: Request, res: Response) => {
  try {
    const couriers = await User.find({ 
      role: 'delivery',
      isActive: { $ne: false } // Assuming you have an isActive field
    }).select('userName phoneNumber email');

    res.status(200).json({ couriers });

  } catch (error) {
    console.error('Get couriers error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments();
    const todayOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    const formattedStats = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.status(200).json({
      totalOrders,
      todayOrders,
      statusBreakdown: formattedStats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Cancel order
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ 
        message: 'Cannot cancel completed order' 
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Order is already cancelled' 
      });
    }

    order.status = 'cancelled';
    
    if (order.statusHistory) {
      order.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        updatedBy: req.user?.userId || 'admin',
        reason // If you want to track cancellation reason
      });
    }

    await order.save();

    res.status(200).json({ 
      message: 'Order cancelled successfully', 
      order 
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


export const getCourierAssignedOrders = async (req: Request, res: Response) => {
  try {
    const courierId = req.user?.userId;
    console.log('🔍 Looking for orders assigned to courier ID:', courierId);

    if (!courierId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Debug: Check total orders with this courier (any status)
    const totalOrdersWithCourier = await Order.countDocuments({ 
      courier: courierId 
    });
    console.log('📋 Total orders assigned to this courier:', totalOrdersWithCourier);

    // Debug: Check orders with specific status
    const ordersWithStatus = await Order.countDocuments({
      courier: courierId,
      status: 'assigntocourier'
    });
    console.log('📋 Orders with assigntocourier status:', ordersWithStatus);

    // Get the actual orders
    const orders = await Order.find({
      courier: courierId,
      status: 'assigntocourier'
    })
    .populate('user.userId', 'userName phoneNumber email')
    .populate('courier', 'userName phoneNumber email')
    .sort({ createdAt: -1 });

    console.log('✅ Found orders for courier:', orders.length);
    
    // Debug: Log first order details if exists
    if (orders.length > 0) {
      console.log('First order details:', {
        id: orders[0]._id,
        status: orders[0].status,
        courierId: orders[0].courier
      });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error('❌ Get courier orders error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
export const completeOrderWithProof = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const proofPhoto = req.file;

    console.log('📸 Completing order with photo proof...');
    console.log('Order ID:', orderId);
    console.log('Courier ID:', req.user?.userId);
    console.log('Photo:', proofPhoto?.filename);
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }
    // 1. Validate photo is provided
    if (!proofPhoto) {
      return res.status(400).json({ 
        message: 'Delivery proof photo is required' 
      });
    }

    // 2. Find and validate order
    const order = await Order.findById(orderId);
    if (!order) {
      // Clean up uploaded file if order not found
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(404).json({ message: 'Order not found' });
    }

    // 3. Validate courier is assigned to this order
    if (!order.courier || order.courier.toString() !== req.user?.userId) {
      // Clean up uploaded file
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(403).json({ 
        message: 'You are not assigned to this order' 
      });
    }

    // 4. Validate current status
    if (order.status.toLowerCase() !== 'assigntocourier') {
      // Clean up uploaded file
      if (proofPhoto.path && fs.existsSync(proofPhoto.path)) {
        fs.unlinkSync(proofPhoto.path);
      }
      return res.status(400).json({ 
        message: 'Order cannot be completed from current status' 
      });
    }

    // 5. Update order status and add delivery proof
    order.status = 'completed';
order.deliveryProof = {
  photoPath: proofPhoto.path,
  photoUrl: `/uploads/delivery-proofs/${proofPhoto.filename}`,
  uploadedAt: new Date(),
  notes: notes || '',
  completedBy: new mongoose.Types.ObjectId(req.user?.userId) // Convert string to ObjectId
};

    // 6. Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    
    order.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      updatedBy: req.user?.userId || 'courier',
      notes: `Order completed with delivery proof${notes ? `: ${notes}` : ''}`
    });

    // 7. Set completion timestamp
    order.completedAt = new Date();

    // 8. Save the order
    const savedOrder = await order.save();

    console.log('✅ Order completed with proof:', {
      orderId: savedOrder._id,
      proofPhoto: proofPhoto.filename,
      completedAt: savedOrder.completedAt
    });

    // 9. Populate and return response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('courier', 'userName phoneNumber email')
      .populate('user.userId', 'userName phoneNumber email');

    res.status(200).json({
      message: 'Order completed successfully with delivery proof',
      order: {
        id: populatedOrder._id,
        status: populatedOrder.status,
        courier: populatedOrder.courier,
        user: populatedOrder.user,
        items: populatedOrder.items,
        address: populatedOrder.address,
        deliveryProof: populatedOrder.deliveryProof,
        completedAt: populatedOrder.completedAt,
        createdAt: populatedOrder.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Complete order with proof error:', error);
    
    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};