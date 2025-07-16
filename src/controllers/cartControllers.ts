import { Request, Response } from 'express';
import Cart from '../models/cart'

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;

  if (!userId && !sessionId) return res.status(400).json({ message: 'Missing user or session' });

  const cart = await Cart.findOne(userId ? { userId } : { sessionId });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  return res.json(cart);
};

export const addItemToCart = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  console.log("Request body:", req.body);
  const { categoryName, quantity } = req.body;

  if (!userId && !sessionId) return res.status(400).json({ message: 'Missing user or session' });

  let cart = await Cart.findOne(userId ? { userId } : { sessionId });
  if (!cart) {
    cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
  }

  const existingItem = cart.items.find(item => item.categoryName === categoryName);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ categoryName, quantity });
  }
  console.log("Saving cart:", cart);
  await cart.save();
  return res.json(cart);
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const { categoryName, quantity } = req.body;

    if (!categoryName || typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ message: "Valid categoryName and quantity are required" });
    }

    const cart = await Cart.findOne(userId ? { userId } : { sessionId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((i) => i.categoryName === categoryName);
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
    const { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({ message: "categoryName is required" });
    }

    const cart = await Cart.findOne(userId ? { userId } : { sessionId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter((item) => item.categoryName !== categoryName);

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
