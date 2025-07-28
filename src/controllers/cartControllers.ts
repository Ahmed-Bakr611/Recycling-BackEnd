import { Request, Response } from 'express';
import Cart, {ICartItem} from '../models/cart'

// Helper function to validate quantity based on measurement unit
const validateQuantity = (quantity: number, measurement_unit: number): { isValid: boolean; message?: string } => {
  if (measurement_unit === 1) { // KG items
    // Allow 0.25 increments: 0.25, 0.5, 0.75, 1.0, 1.25, etc.
    // Use Math.round to handle floating point precision issues
    const multiplied = Math.round(quantity * 4);
    const isValid = multiplied >= 1 && Math.abs(quantity * 4 - multiplied) < 0.0001;
    return {
      isValid,
      message: !isValid ? "For KG items, quantity must be in 0.25 increments (0.25, 0.5, 0.75, 1.0, etc.)" : undefined
    };
  } else { // Piece items (measurement_unit = 2)
    // Require whole numbers >= 1
    const isValid = Number.isInteger(quantity) && quantity >= 1;
    return {
      isValid,
      message: !isValid ? "For Piece items, quantity must be whole numbers >= 1" : undefined
    };
  }
};

// Helper function to get cart identifier - prioritizes userId over sessionId
const getCartIdentifier = (req: Request) => {
  console.log("req:", req.isAuthenticated);
  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  
  if (userId) {
    return { userId };
  } else if (sessionId) {
    return { sessionId };
  } else {
    return null;
  }
};

export const getCart = async (req: Request, res: Response) => {
  try {
    const cartIdentifier = getCartIdentifier(req);
    
    if (!cartIdentifier) {
      return res.status(400).json({ message: 'Missing user or session' });
    }

    let cart = await Cart.findOne(cartIdentifier);
    if (!cart) {
      cart = new Cart({ ...cartIdentifier, items: [] });
      await cart.save();
    }
    
    return res.status(200).json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ message: 'Failed to get cart', error });
  }
};


export const addItemToCart = async (req: Request, res: Response) => {
  try {
    console.log('in add to cart');
    
    const cartIdentifier = getCartIdentifier(req);
    const { categoryId, categoryName, itemName, image, points, price, measurement_unit, quantity } = req.body;

    if (!cartIdentifier) {
      return res.status(400).json({ message: 'Missing user or session' });
    }

    // Validate quantity based on measurement unit
    const validation = validateQuantity(quantity, measurement_unit);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    let cart = await Cart.findOne(cartIdentifier);
    if (!cart) {
      cart = new Cart({ ...cartIdentifier, items: [] });
    }

    // Find item by categoryId
    const existingItem = cart.items.find(item => item.categoryId === categoryId);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      // Validate the new total quantity
      const newQuantityValidation = validateQuantity(newQuantity, measurement_unit);
      if (!newQuantityValidation.isValid) {
        return res.status(400).json({ message: newQuantityValidation.message });
      }
      existingItem.quantity = newQuantity;
      // Update other fields if provided
      if (itemName) existingItem.itemName = itemName;
      if (image) existingItem.image = image;
      if (points !== undefined) existingItem.points = points;
      if (price !== undefined) existingItem.price = price;
      if (categoryName) existingItem.categoryName = categoryName;
      if (measurement_unit) existingItem.measurement_unit = measurement_unit;
    } else {
      cart.items.push({ categoryId, categoryName, itemName, image, points, price, measurement_unit, quantity });
    }

    await cart.save();
    return res.json(cart);
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ message: 'Failed to add item to cart', error });
  }
};


export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const cartIdentifier = getCartIdentifier(req);
    const { categoryId, quantity } = req.body;

    if (!cartIdentifier) {
      return res.status(400).json({ message: 'Missing user or session' });
    }

    if (!categoryId || typeof quantity !== "number") {
      return res.status(400).json({ message: "Valid categoryId and quantity are required" });
    }

    let cart = await Cart.findOne(cartIdentifier);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    
    const item = cart.items.find((i) => i.categoryId === categoryId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Validate quantity based on measurement unit
    const validation = validateQuantity(quantity, item.measurement_unit);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    item.quantity = quantity;
    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({ message: "Failed to update item", error });
  }
};

export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const cartIdentifier = getCartIdentifier(req);
    const categoryId = req.params.categoryId?.trim();

    if (!cartIdentifier) {
      return res.status(400).json({ message: 'Missing user or session' });
    }

    if (!categoryId) {
      return res.status(400).json({ message: "categoryId is required" });
    }

    let cart = await Cart.findOne(cartIdentifier);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.categoryId.toString().trim() !== categoryId);
    
    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: "Item not found in cart" });
    }
    
    await cart.save();
    return res.status(200).json(cart);
  } catch (error) {
    console.error('Remove cart item error:', error);
    return res.status(500).json({ message: "Failed to remove item", error });
  }
};

export const clearCart = async (req: Request, res: Response) => {
  try {
    const cartIdentifier = getCartIdentifier(req);

    if (!cartIdentifier) {
      return res.status(400).json({ message: "User or session ID is required" });
    }

    let cart = await Cart.findOne(cartIdentifier);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    
    cart.items = [];
    await cart.save();
    return res.json({ message: "Cart cleared", cart });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({ message: "Failed to clear cart", error });
  }
};
