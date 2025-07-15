import Order from "../models/pickupOrder";
import { Request, Response } from "express";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { userId, address, items } = req.body;

    const missingFields = [];
    if (!userId) missingFields.push("userId");
    if (!address) missingFields.push("address");
    if (!items) missingFields.push("items");

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required field(s): ${missingFields.join(", ")}` 
      });
    }

    const newOrder = new Order({ userId, address, items });
    await newOrder.save();

    res.status(201).json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Could not retrieve orders" });
  }
};
