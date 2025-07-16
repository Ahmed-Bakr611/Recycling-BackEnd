import { log } from 'console';
import Cart from '../models/cart';
import { Request, Response } from 'express';

export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const sessionId = req.sessionId;

        if (!userId && !sessionId) {
            return res.status(400).json({ message: 'User or session ID is required' });
        }

        const cart = await Cart.findOne({
            ...(userId ? { userId } : { sessionId })
        });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        return res.json(cart);
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }

}

export const addItemToCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;

    if (!userId && !sessionId) {
      return res.status(400).json({ message: 'User or session ID is required' });
    }

    console.log(req.body)

    const { categoryName, quantity } = req.body;
    if (!categoryName || typeof quantity !== 'number') {
      return res.status(400).json({ message: 'categoryName and quantity are required' });
    }

    let cart = await Cart.findOne({
      ...(userId ? { userId } : { sessionId }),
    });

    if (!cart) {
      cart = new Cart({
        ...(userId ? { userId } : { sessionId }),
        items: [],
      });
    }

    const existingItem = cart.items.find(item => item.categoryName === categoryName);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ categoryName, quantity });
    }

    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to add item', error });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: 'User or session ID is required' });
  }

  const { categoryName, quantity } = req.body;

  if (!categoryName || typeof quantity !== 'number' || quantity < 1) {
    return res.status(400).json({ message: 'Valid categoryName and quantity are required' });
  }

  let cart = await Cart.findOne({
    ...(userId ? { userId } : { sessionId }),
  });

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const item = cart.items.find(i => i.categoryName === categoryName);
  if (!item) return res.status(404).json({ error: 'Item not found in cart' });

  item.quantity = quantity;
  await cart.save();
  return res.status(200).json(cart);
};

export const removeCartItem = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: 'User or session ID is required' });
  }

  const { categoryName } = req.params;
  if (!categoryName) {
    return res.status(400).json({ message: 'Valid categoryName is required' });
  }

  let cart = await Cart.findOne({
    ...(userId ? { userId } : { sessionId }),
  });

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  cart.items = cart.items.filter(item => item.categoryName !== categoryName);
  await cart.save();

  return res.status(200).json(cart);
};


export const clearCart = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;

    if (!userId && !sessionId) {
        return res.status(400).json({ message: 'User or session ID is required' });
    }

   const cart = await Cart.findOneAndUpdate(
        userId ? { userId } : { sessionId },
        { items: [] },
        { new: true }
    );

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    return res.json({ message: 'Cart cleared', cart });
}