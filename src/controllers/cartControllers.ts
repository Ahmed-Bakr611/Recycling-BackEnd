import { Request, Response } from "express";
import Cart from "../models/cart";
import { TranslationService } from "../services/translationService";

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
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const language = (req.query.lang as 'en' | 'ar') || (req as any).language || 'en';

    console.log('=== getCart Debug ===');
    console.log('Language requested:', language);
    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);

    if (!userId && !sessionId) {
      return res.status(400).json({ message: "Missing user or session" });
    }

    let cart = null;
    if (userId) {
      cart = await Cart.findOne({ userId }).lean();
    } else {
      cart = await Cart.findOne({ sessionId }).lean();
    }

    if (!cart) {
      cart = { items: [] };
    }

    console.log('Found cart with items count:', cart.items?.length || 0);

    if (language === 'ar' && cart.items && cart.items.length > 0) {
      console.log('Starting Arabic translation for cart items...');
      
      try {
        const translations = await TranslationService.getTranslations(language);
        console.log(`Retrieved ${Object.keys(translations).length} translations`);
        
        // Create a reverse mapping of Arabic to English category names
        const reverseCategoryMap: Record<string, string> = {};
        const categoryKeys = Object.keys(translations).filter(key => 
          key.startsWith('cat_') && key.endsWith('_name')
        );
        
        for (const catKey of categoryKeys) {
          const englishName = catKey.replace('cat_', '').replace('_name', '');
          reverseCategoryMap[translations[catKey]] = englishName;
        }
        
        // Translate cart items while preserving slugs
        cart.items = cart.items.map((item: any) => {
          const cleanCategoryName = item.categoryName?.trim() || '';
          let translatedItemName = item.name;
          let translatedCategoryName = cleanCategoryName;
          let categorySlug = item.categorySlug; // Preserve original slug
          let itemSlug = item.itemSlug; // Preserve original slug
          
          // Step 1: Find English category name
          let englishCategoryName = reverseCategoryMap[cleanCategoryName] || '';
          const categoryKey = `cat_${(cleanCategoryName || '').toLowerCase()}_name`;
if (translations[categoryKey]) {
  translatedCategoryName = translations[categoryKey];
}
          
          if (englishCategoryName) {
            console.log(`✅ Found English category: "${englishCategoryName}" for Arabic: "${cleanCategoryName}"`);
            
            // Step 2: Try to translate item name using standard key patterns
            const normalizedItemName = item.name.toLowerCase().replace(/-/g, '_');
            const possibleItemKeys = [
              `item_${englishCategoryName}_${normalizedItemName}`,
              `item_${englishCategoryName}${normalizedItemName}`,
              `item_${englishCategoryName}_${item.name}`,
              `item_${englishCategoryName}${item.name}`
            ];
            
            for (const itemKey of possibleItemKeys) {
              if (translations[itemKey]) {
                translatedItemName = translations[itemKey];
                console.log(`✅ Found item translation: ${item.name} -> ${translatedItemName}`);
                break;
              }
            }
            
            // Step 3: Get Arabic category name (should be the same as original)
            const categoryKey = `cat_${englishCategoryName}_name`;
            if (translations[categoryKey]) {
              translatedCategoryName = translations[categoryKey];
            }
          } else {
            console.log(`⚠️ No English category found for: "${cleanCategoryName}"`);
            
            // Fallback: Try direct item name matching
            const normalizedItemName = item.name.toLowerCase().replace(/-/g, '_');
            const itemKeys = Object.keys(translations).filter(key => 
              key.startsWith('item_') && 
              key.toLowerCase().includes(normalizedItemName)
            );
            
            if (itemKeys.length > 0) {
              translatedItemName = translations[itemKeys[0]];
              console.log(`✅ Found fallback translation: ${item.name} -> ${translatedItemName}`);
            }
          }
          
          return {
            ...item,
            name: translatedItemName,
            categoryName: translatedCategoryName,
            categorySlug, // Include the slug
            itemSlug // Include the slug
          };
        });
        
        console.log('Cart items translation completed');
      } catch (translationError) {
        console.error('Cart translation failed:', translationError);
      }
    }

    return res.status(200).json(cart);
  } catch (error) {
    console.error("Error in getCart:", error);
    return res.status(500).json({ message: "Server error", error });
  }
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
    const { _id, quantity } = req.body;

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

    const item = cart.items.find((i) => i._id === _id);
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
    console.log("Request headers:", {
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
      "user-agent": req.headers["user-agent"],
    });
    console.log("========================");

    if (!userId && !sessionId) {
      return res.status(400).json({ message: "Missing user or session" });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid cart items" });
    }

    // Validate all items before saving
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

      const validation = validateQuantity(item.quantity, item.measurement_unit);
      if (!validation.isValid) {
        validationErrors.push(
          `${item.name || item._id}: ${validation.message}`
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

    // DEBUG: Log the cart search
    console.log("Found existing cart:", cart ? cart._id : "None");
    if (cart) {
      console.log(
        "Cart belongs to:",
        cart.userId ? `User ${cart.userId}` : `Session ${cart.sessionId}`
      );
      console.log("Current items in cart:", cart.items.length);
    }

    if (!cart) {
      // Create new cart with proper userId or sessionId
      cart = new Cart({
        ...(userId ? { userId } : { sessionId }),
        items: [],
      });
      console.log(
        "Created new cart for:",
        userId ? `User ${userId}` : `Session ${sessionId}`
      );
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