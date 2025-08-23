import { Request, Response } from "express";
import Cart from "../models/cart";

const validateQuantity = (
  quantity: number,
  measurement_unit: number
): { isValid: boolean; message?: string } => {
  if (measurement_unit === 1) {
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
  // DEBUG: Log the request details
  console.log("=== GET CART DEBUG ===");
  console.log("User ID:", userId);
  console.log("Session ID:", sessionId);
  console.log("Request headers:", {
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
  });

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
  // console.log("😜😜😜😜😜😜😜😜😜😜😜😜");
  // console.log(`userId = ${userId} , sessionID = ${sessionId}`);
  // console.log("😜😜😜😜😜😜😜😜😜😜😜😜");

  return res.status(200).json(cart);
};


export const addItemToCart = async (req: Request, res: Response) => {
  console.log("in add to cart");

  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  const {
    _id,
    categoryId,
    categoryName, // Now expects bilingual object: { en: "...", ar: "..." }
    name, // Now expects bilingual object: { en: "...", ar: "..." }
    image,
    points,
    price,
    measurement_unit,
    quantity,
  } = req.body;

  if (!userId && !sessionId) {
    return res.status(400).json({ message: "Missing user or session" });
  }

  // Validate that name and categoryName are bilingual objects
  if (typeof name !== 'object' || !name.en || !name.ar) {
    return res.status(400).json({ 
      message: "Item name must be a bilingual object with 'en' and 'ar' properties" 
    });
  }

  if (typeof categoryName !== 'object' || !categoryName.en || !categoryName.ar) {
    return res.status(400).json({ 
      message: "Category name must be a bilingual object with 'en' and 'ar' properties" 
    });
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

  // Find item by _id
  const existingItem = cart.items.find((item) => item._id === _id);
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
    // Update bilingual fields
    if (name) existingItem.name = name;
    if (categoryName) existingItem.categoryName = categoryName;
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
    const { 
      _id, 
      quantity,
      // NEW: Accept item details for creating new items
      categoryId,
      categoryName,
      name,
      image,
      points,
      price,
      measurement_unit
    } = req.body;

    if (!_id || typeof quantity !== "number") {
      return res
        .status(400)
        .json({ message: "Valid _id and quantity are required" });
    }

    let cart = await Cart.findOne(userId ? { userId } : { sessionId });
    if (!cart) {
      cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
      await cart.save();
    }

    let item = cart.items.find((i) => i._id === _id);
    
    if (!item) {
      // NEW: Create new item if it doesn't exist (only if we have the required data)
      if (!categoryId || !name || !categoryName) {
        return res.status(400).json({ 
          message: "Item not found in cart. To create new item, provide categoryId, name, and categoryName." 
        });
      }

      // Validate that name and categoryName are bilingual objects for new items
      if (typeof name !== 'object' || !name.en || !name.ar) {
        return res.status(400).json({ 
          message: "Item name must be a bilingual object with 'en' and 'ar' properties" 
        });
      }

      if (typeof categoryName !== 'object' || !categoryName.en || !categoryName.ar) {
        return res.status(400).json({ 
          message: "Category name must be a bilingual object with 'en' and 'ar' properties" 
        });
      }

      // Create new item
      const newItem = {
        _id,
        categoryId,
        categoryName,
        name,
        image: image || '',
        points: points || 0,
        price: price || 0,
        measurement_unit: measurement_unit || 1,
        quantity: 0 // Will be set below
      };

      cart.items.push(newItem);
      item = cart.items[cart.items.length - 1]; // Get reference to the newly added item
    }

    // Validate quantity based on measurement unit
    const validation = validateQuantity(quantity, item.measurement_unit);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    // Update quantity
    item.quantity = quantity;
    
    // If quantity is 0 or less, remove the item from cart
    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i._id !== _id);
    }

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
    const id = req.params._id?.trim();
    console.log("Removing item with id:", id);
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    let cart = await Cart.findOne(userId ? { userId } : { sessionId });
    if (!cart) {
      cart = new Cart({ ...(userId ? { userId } : { sessionId }), items: [] });
      await cart.save();
    }
    cart.items = cart.items.filter((item) => item._id.toString().trim() !== id);
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
export const saveCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const { items } = req.body;

    // DEBUG: Log the request details
    console.log("=== SAVE CART DEBUG ===");
    console.log("User ID:", userId);
    console.log("Session ID:", sessionId);
    console.log("Items count:", items?.length);

    if (!userId && !sessionId) {
      return res.status(400).json({ message: "Missing user or session" });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid cart items" });
    }

    // Validate all items before saving (including bilingual fields)
    const validationErrors: string[] = [];
    for (const item of items) {
      if (
        !item._id ||
        !item.measurement_unit ||
        typeof item.quantity !== "number"
      ) {
        validationErrors.push(
          `Invalid item structure: ${JSON.stringify(item)}`
        );
        continue;
      }

      // Validate bilingual fields
      if (typeof item.name !== 'object' || !item.name.en || !item.name.ar) {
        validationErrors.push(
          `Item ${item._id}: name must be bilingual object with 'en' and 'ar' properties`
        );
      }

      if (typeof item.categoryName !== 'object' || !item.categoryName.en || !item.categoryName.ar) {
        validationErrors.push(
          `Item ${item._id}: categoryName must be bilingual object with 'en' and 'ar' properties`
        );
      }

      const validation = validateQuantity(item.quantity, item.measurement_unit);
      if (!validation.isValid) {
        validationErrors.push(
          `${item.name?.en || item.name || item._id}: ${validation.message}`
        );
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Find cart using same logic as getCart
    let cart = await Cart.findOne(userId ? { userId } : { sessionId });

    if (!cart) {
      cart = new Cart({
        ...(userId ? { userId } : { sessionId }),
        items: [],
      });
    }

    // Replace entire cart with incoming items
    cart.items = items;
    await cart.save();

    console.log(`Cart saved successfully - ${cart.items.length} items saved`);

    return res.status(200).json({
      message: "Cart saved successfully",
      debug: {
        userId,
        sessionId,
        cartId: cart._id,
        itemCount: cart.items.length,
      },
    });
  } catch (error) {
    console.error("Error saving cart:", error);
    return res.status(500).json({ message: "Failed to save cart", error });
  }
};
