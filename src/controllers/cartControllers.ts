import { Request, Response } from "express";
import Cart from "../models/cart";

// Helper function to validate quantity based on measurement unit
const validateQuantity = (
  quantity: number,
  measurement_unit: number
): { isValid: boolean; message?: string } => {
  if (measurement_unit === 1) {
    // KG items
    // Allow 0.25 increments: 0.25, 0.5, 0.75, 1.0, 1.25, etc.
    // Use Math.round to handle floating point precision issues
    const multiplied = Math.round(quantity * 4);
    const isValid =
      multiplied >= 1 && Math.abs(quantity * 4 - multiplied) < 0.0001;
    return {
      isValid,
      message: !isValid
        ? "For KG items, quantity must be in 0.25 increments (0.25, 0.5, 0.75, 1.0, etc.)"
        : undefined,
    };
  } else {
    // Piece items (measurement_unit = 2)
    // Require whole numbers >= 1
    const isValid = Number.isInteger(quantity) && quantity >= 1;
    return {
      isValid,
      message: !isValid
        ? "For Piece items, quantity must be whole numbers >= 1"
        : undefined,
    };
  }
};

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: "Missing user or session" });
  }

  let cart = null;
  if (userId) {
    cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
    if (!cart) {
      cart = new Cart({ sessionId, items: [] });
      await cart.save();
    }
  }
  return res.status(200).json(cart);
};

export const addItemToCart = async (req: Request, res: Response) => {
  console.log("in add to cart");

  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  const {
    _id,
    categoryId,
    categoryName,
    name,
    image,
    points,
    price,
    measurement_unit,
    quantity,
  } = req.body;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: "Missing user or session" });
  }

  // Validate quantity based on measurement unit
  const validation = validateQuantity(quantity, measurement_unit);
  if (!validation.isValid) {
    return res.status(400).json({ message: validation.message });
  }

  let cart = await Cart.findOne(userId ? { userId } : { sessionId });
  if (!cart) {
    cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
  }

  // Find item by categoryId
  const existingItem = cart.items.find(
    (item) => item.categoryId === categoryId
  );
  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    // Validate the new total quantity
    const newQuantityValidation = validateQuantity(
      newQuantity,
      measurement_unit
    );
    if (!newQuantityValidation.isValid) {
      return res.status(400).json({ message: newQuantityValidation.message });
    }
    existingItem.quantity = newQuantity;
    // Optionally update other fields if needed
    if (name) existingItem.name = name;
    if (image) existingItem.image = image;
    if (points) existingItem.points = points;
    if (price) existingItem.price = price;
    if (measurement_unit) existingItem.measurement_unit = measurement_unit;
  } else {
    cart.items.push({
      _id,
      categoryId,
      categoryName,
      name,
      image,
      points,
      price,
      measurement_unit,
      quantity,
    });
  }

  await cart.save();
  return res.json(cart);
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const { categoryId, quantity } = req.body;

    if (!categoryId || typeof quantity !== "number") {
      return res
        .status(400)
        .json({ message: "Valid categoryId and quantity are required" });
    }

    let cart = await Cart.findOne(userId ? { userId } : { sessionId });
    if (!cart) {
      cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
      await cart.save();
    }

    const item = cart.items.find((i) => i.categoryId === categoryId);
    if (!item)
      return res.status(404).json({ message: "Item not found in cart" });

    // Validate quantity based on measurement unit
    const validation = validateQuantity(quantity, item.measurement_unit);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    item.quantity = quantity;
    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update item", error });
  }
};

export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const categoryId = req.params.categoryId?.trim();

    if (!categoryId) {
      return res.status(400).json({ message: "categoryId is required" });
    }

    let cart = await Cart.findOne(userId ? { userId } : { sessionId });
    if (!cart) {
      cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
      await cart.save();
    }
    cart.items = cart.items.filter(
      (item) => item.categoryId.toString().trim() !== categoryId
    );
    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove item", error });
  }
};

export const clearCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;

    if (!userId && !sessionId) {
      return res
        .status(400)
        .json({ message: "User or session ID is required" });
    }

    let cart = await Cart.findOne(userId ? { userId } : { sessionId });
    if (!cart) {
      cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
      await cart.save();
    }
    cart.items = [];
    await cart.save();
    return res.json({ message: "Cart cleared", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear cart", error });
  }
};
