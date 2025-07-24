// controllers/adminController.ts
import Order from '../models/pickupOrder';
import User from '../models/users';
import { Request, Response } from "express";

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
    // 1. Validate required fields
    if (!courierId || !status) {
      return res.status(400).json({ 
        message: 'Courier ID and status are required' 
      });
    }

    // 2. Validate order exists
    const order = await Order.findById(orderId).populate('user.userId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // 3. Validate courier exists and has delivery role
    const courier = await User.findById(courierId);
    if (!courier || courier.role !== 'delivery') {
      return res.status(400).json({ 
        message: 'Invalid courier - user not found or not a delivery person' 
      });
    }

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

    // 5. Update order
    order.courier = courierId;
    order.status = newStatus;

    // Add to status history if statusHistory exists
    if (order.statusHistory) {
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        updatedBy: req.user?.userId || 'admin' // Assuming req.user from auth middleware
      });
    }

    await order.save();

    // 6. Populate courier info for response
try {
  await order.populate('courier', 'userName phoneNumber email');
} catch (err) {
  console.error('Populate error:', err);
}

// Normalize status string before saving
const normalizedStatusMap: Record<string, OrderStatus> = {
  pending: 'pending',
  assigntocourier: 'assigntocourier',
  cancelled: 'cancelled',
  completed: 'completed',
};
order.status = normalizedStatusMap[newStatus] || newStatus;

res.status(200).json({ 
  message: 'Courier assigned successfully', 
  order: {
    id: order._id,
    status: order.status,
    courier: order.courier,
    user: order.user,
    items: order.items,
    address: order.address,
    createdAt: order.createdAt
  }
});

  } catch (error) {
    console.error('Assign courier error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


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