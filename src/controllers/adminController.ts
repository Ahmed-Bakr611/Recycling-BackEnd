import express from "express";
import mongoose from 'mongoose';
import Order from '../models/pickupOrder';
import User from '../models/users';
import { Request, Response } from "express";

// 1. Get all orders for admin with pagination and filtering
export const getAllOrdersForAdmin = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    // Build filter
    let filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { 'user.userName': { $regex: search, $options: 'i' } },
        { 'user.phoneNumber': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get orders with pagination
    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user.userId', 'userName phoneNumber email imageUrl');
    
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / Number(limit));
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalOrders,
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders' 
    });
  }
};

// 2. Get pending orders for admin approval
export const getPendingOrders = async (req: Request, res: Response) => {
  try {
    const pendingOrders = await Order.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('user.userId', 'userName phoneNumber email imageUrl');
    
    res.json({
      success: true,
      data: pendingOrders
    });
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending orders' 
    });
  }
};

// 3. Get assigned orders
export const getAssignedOrders = async (req: Request, res: Response) => {
  try {
    const assignedOrders = await Order.find({ status: 'assigntocourier' })
      .sort({ createdAt: -1 })
      .populate('user.userId', 'userName phoneNumber email imageUrl');
    
    res.json({
      success: true,
      data: assignedOrders
    });
  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch assigned orders' 
    });
  }
};

// 4. Confirm order
export const confirmOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Update order status
    order.status = 'confirmed';
    order.updatedAt = new Date();
    order.adminNotes = adminNotes || 'Order confirmed by admin';
    order.confirmedAt = new Date();
    
    // Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      updatedBy: 'admin',
      notes: adminNotes || 'Order confirmed by admin'
    });
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Order confirmed successfully',
      data: {
        orderId: id,
        status: 'confirmed',
        adminNotes: adminNotes || 'Order confirmed by admin',
        confirmedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to confirm order' 
    });
  }
};

// 5. Assign driver to order
export const assignDriverToOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { driverId, assignmentNotes } = req.body;
    
    // Validate driver exists and has delivery role
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'delivery') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid driver' 
      });
    }
    
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Update order
    order.status = 'assigntocourier';
    order.courier = driverId;
    order.updatedAt = new Date();
    order.adminNotes = assignmentNotes || 'Driver assigned to order';
    order.assignedAt = new Date();
    
    // Add to status history
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: 'assigntocourier',
      timestamp: new Date(),
      updatedBy: 'admin',
      notes: assignmentNotes || 'Driver assigned to order'
    });
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Driver assigned successfully',
      data: {
        orderId: id,
        driverId,
        status: 'assigntocourier',
        assignmentNotes: assignmentNotes || 'Driver assigned to order',
        assignedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to assign driver' 
    });
  }
};

// 5. Delete order
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      message: "Order deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order'
    });
  }
};

// 6. Get available drivers (users with delivery role)
export const getAvailableDrivers = async (req: Request, res: Response) => {
  try {
    const drivers = await User.find({ role: 'delivery' })
      .select('name email phoneNumber imgUrl')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers'
    });
  }
}; 