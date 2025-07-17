import { Request, Response } from 'express';
import Cart from '../models/cart'

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: 'Missing user or session' });
  }

  let cart = null;

  // Priority: if user is logged in, prefer their cart
  if (userId) {
    cart = await Cart.findOne({ userId });
  }

  // If no cart found for user, try session
  if (!cart && sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  return res.status(200).json(cart);
};


export const addItemToCart = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  const newItem = req.body;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: 'Missing user or session' });
  }

  let cart = await Cart.findOne(userId ? { userId } : { sessionId });
  if (!cart) {
    cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
  }

  const existingItem = cart.items.find(item => item.categoryId === newItem.categoryId);

  if (existingItem) {
    existingItem.quantity += newItem.quantity;
  } else {
    cart.items.push(newItem);
  }

  await cart.save();
  return res.json(cart);
};


export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const { categoryId, quantity } = req.body;

    if (!categoryId || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ message: "Valid categoryId and quantity are required" });
    }

    const cart = await Cart.findOne(userId ? { userId } : { sessionId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((i) => i.categoryId === categoryId);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

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

    const cart = await Cart.findOne(userId ? { userId } : { sessionId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter(item => item.categoryId.toString().trim() !== categoryId);

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
      return res.status(400).json({ message: "User or session ID is required" });
    }

    const cart = await Cart.findOneAndUpdate(
      userId ? { userId } : { sessionId },
      { items: [] },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    return res.json({ message: "Cart cleared", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear cart", error });
  }
};
