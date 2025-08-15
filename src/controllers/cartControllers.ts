import { Request, Response } from "express";
import { safeName } from "../utils/strings";
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
// Updated getCart function to handle mixed language scenarios
export const getCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.sessionId;
    const language = (req.query.lang as "en" | "ar") || (req as any).language || "en";

    console.log("=== getCart Debug ===");
    console.log("Language requested:", language);
    console.log("User ID:", userId);
    console.log("Session ID:", sessionId);

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

    console.log("Found cart with items count:", cart.items?.length || 0);

    // Process translations if we have items
    if (cart.items && cart.items.length > 0) {
      if (language === "ar") {
        console.log("Processing cart for Arabic language...");
        
        try {
          const translations = await TranslationService.getTranslations("ar");
          console.log(`Retrieved ${Object.keys(translations).length} Arabic translations`);

          // Process each item individually - translate whatever needs translation
          cart.items = cart.items.map((item: any) => {
              const cleanCategoryName = safeName(item.categoryName);
              const cleanItemName = safeName(item.name);
            let translatedItemName = cleanItemName;
            let translatedCategoryName = cleanCategoryName;

            console.log(`\n--- Processing cart item ---`);
            console.log(`Item: "${cleanItemName}"`);
            console.log(`Category: "${cleanCategoryName}"`);
            console.log(`Item is Arabic: ${/[\u0600-\u06FF]/.test(cleanItemName)}`);
            console.log(`Category is Arabic: ${/[\u0600-\u06FF]/.test(cleanCategoryName)}`);

            // TRANSLATE CATEGORY NAME if it's in English
            if (!/[\u0600-\u06FF]/.test(cleanCategoryName)) {
              console.log(`🔄 Translating English category: "${cleanCategoryName}"`);

              // Try multiple category key formats
              const possibleCategoryKeys = [
                TranslationService.generateKey(cleanCategoryName, "cat", "name"),
                `cat_${cleanCategoryName.toLowerCase()}_name`,
                `cat_${cleanCategoryName}_name`,
                `cat_${cleanCategoryName.charAt(0).toUpperCase() + cleanCategoryName.slice(1)}_name`,
                // Handle Paper vs paper inconsistency
                `cat_${cleanCategoryName.charAt(0).toUpperCase() + cleanCategoryName.slice(1).toLowerCase()}_name`,
              ];

              console.log("Trying category keys:", possibleCategoryKeys);

              for (const categoryKey of possibleCategoryKeys) {
                if (translations[categoryKey]) {
                  translatedCategoryName = translations[categoryKey];
                  console.log(`✅ Category translated: "${cleanCategoryName}" -> "${translatedCategoryName}" (key: ${categoryKey})`);
                  break;
                }
              }

              // Manual fallback for your specific case
              if (translatedCategoryName === cleanCategoryName) {
                const manualCategoryMappings: Record<string, string> = {
                  'paper': 'ورق',
                  'Paper': 'ورق',
                  'electronics': 'إلكترونيات',
                  'Electronics': 'إلكترونيات',
                  'metals': 'معادن',
                  'Metals': 'معادن',
                  'plastic': 'بلاستيك',
                  'Plastic': 'بلاستيك',
                  'e-waste': 'نفايات إلكترونية',
                  'E-waste': 'نفايات إلكترونية',
                  'home appliances': 'أجهزة منزلية',
                  'Home Appliances': 'أجهزة منزلية',
                  'spare parts': 'قطع غيار',
                  'Spare Parts': 'قطع غيار'
                };

                if (manualCategoryMappings[cleanCategoryName]) {
                  translatedCategoryName = manualCategoryMappings[cleanCategoryName];
                  console.log(`✅ Category translated (manual): "${cleanCategoryName}" -> "${translatedCategoryName}"`);
                } else {
                  console.log(`⚠️ No Arabic translation found for category: "${cleanCategoryName}"`);
                }
              }
            } else {
              console.log(`✅ Category already in Arabic: "${cleanCategoryName}"`);
            }

            // TRANSLATE ITEM NAME if it's in English
            if (!/[\u0600-\u06FF]/.test(cleanItemName)) {
              console.log(`🔄 Translating English item: "${cleanItemName}"`);

              // Use the ORIGINAL English category name for key generation
              const originalCategoryName = item.categoryName?.trim() || "";
              const possibleItemKeys = [
                `item_${originalCategoryName}_${cleanItemName}`,
                `item_${originalCategoryName}_${cleanItemName.toLowerCase()}`,
                `item_${originalCategoryName}_${cleanItemName.replace(/\s+/g, "_")}`,
                TranslationService.generateKey(`${originalCategoryName}_${cleanItemName}`, "item"),
                // Also try with Paper (capitalized) since your category might be stored as "Paper"
                `item_Paper_${cleanItemName}`,
                `item_paper_${cleanItemName}`,
                // Try with underscores
                `item_Paper_${cleanItemName.replace(/\s+/g, "_")}`,
                `item_paper_${cleanItemName.replace(/\s+/g, "_")}`,
              ];

              console.log("Trying item keys:", possibleItemKeys);

              for (const itemKey of possibleItemKeys) {
                if (translations[itemKey]) {
                  translatedItemName = translations[itemKey];
                  console.log(`✅ Item translated: "${cleanItemName}" -> "${translatedItemName}" (key: ${itemKey})`);
                  break;
                }
              }

              if (translatedItemName === cleanItemName) {
                console.log(`⚠️ No Arabic translation found for item: "${cleanItemName}"`);
              }
            } else {
              console.log(`✅ Item already in Arabic: "${cleanItemName}"`);
            }

            const rawNameLocal = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
            const nameObjLocal = (typeof item.name === 'object') ? item.name : { en: rawNameLocal };
            const result = {
              ...item,
              name: translatedItemName,
              nameObj: nameObjLocal,
              categoryName: translatedCategoryName,
              categorySlug: item.categorySlug,
              itemSlug: item.itemSlug || (rawNameLocal ? rawNameLocal.replace(/\s+/g, '-').toLowerCase() : undefined),
            };

            console.log(`Final result - Item: "${result.name}", Category: "${result.categoryName}"`);
            return result;
          });

          console.log("✅ Cart Arabic translation completed");
        } catch (translationError) {
          console.error("❌ Cart Arabic translation failed:", translationError);
        }
      } else if (language === "en") {
        console.log("Processing cart for English language...");
        
        try {
          const arabicTranslations = await TranslationService.getTranslations("ar");
          const reverseTranslations: Record<string, string> = {};
          
          Object.entries(arabicTranslations).forEach(([key, arabicValue]) => {
            reverseTranslations[arabicValue] = key;
          });

          console.log(`Created reverse mapping with ${Object.keys(reverseTranslations).length} entries`);

          cart.items = cart.items.map((item: any) => {
            const cleanCategoryName = safeName(item.categoryName);
            const cleanItemName = safeName(item.name);
            let translatedItemName = cleanItemName;
            let translatedCategoryName = cleanCategoryName;

            console.log(`\n--- Processing cart item for English ---`);
            console.log(`Item: "${cleanItemName}"`);
            console.log(`Category: "${cleanCategoryName}"`);

            // TRANSLATE CATEGORY NAME if it's in Arabic
            if (/[\u0600-\u06FF]/.test(cleanCategoryName)) {
              console.log(`🔄 Translating Arabic category to English: "${cleanCategoryName}"`);

              const englishKey = reverseTranslations[cleanCategoryName];
              if (englishKey && englishKey.startsWith("cat_")) {
                const keyParts = englishKey.split("_");
                if (keyParts.length >= 3) {
                  const englishName = keyParts.slice(1, -1).join("_");
                  // Capitalize first letter
                  translatedCategoryName = englishName.charAt(0).toUpperCase() + englishName.slice(1);
                  console.log(`✅ Category translated to English: "${cleanCategoryName}" -> "${translatedCategoryName}" (key: ${englishKey})`);
                }
              } else {
                // Manual reverse mapping
                const manualReverseCategoryMappings: Record<string, string> = {
                  'ورق': 'Paper',
                  'إلكترونيات': 'Electronics',
                  'معادن': 'Metals',
                  'بلاستيك': 'Plastic',
                  'نفايات إلكترونية': 'E-waste',
                  'أجهزة منزلية': 'Home Appliances',
                  'قطع غيار': 'Spare Parts'
                };

                if (manualReverseCategoryMappings[cleanCategoryName]) {
                  translatedCategoryName = manualReverseCategoryMappings[cleanCategoryName];
                  console.log(`✅ Category translated to English (manual): "${cleanCategoryName}" -> "${translatedCategoryName}"`);
                } else {
                  console.log(`⚠️ No English translation found for Arabic category: "${cleanCategoryName}"`);
                }
              }
            } else {
              console.log(`✅ Category already in English: "${cleanCategoryName}"`);
            }

            // TRANSLATE ITEM NAME if it's in Arabic
            if (/[\u0600-\u06FF]/.test(cleanItemName)) {
              console.log(`🔄 Translating Arabic item to English: "${cleanItemName}"`);

              const englishKey = reverseTranslations[cleanItemName];
              if (englishKey && englishKey.startsWith("item_")) {
                // Extract English name from the key
                const keyParts = englishKey.split("_");
                if (keyParts.length >= 3) {
                  const englishName = keyParts.slice(2).join("_").replace(/_/g, " ");
                  translatedItemName = englishName;
                  console.log(`✅ Item translated to English: "${cleanItemName}" -> "${translatedItemName}" (key: ${englishKey})`);
                }
              } else {
                // Manual reverse mapping for common items
                const manualReverseItemMappings: Record<string, string> = {
                  'ورق متقطع': 'shredded paper',
                  'كتب': 'books',
                  'جرائد': 'newspaper',
                  'مروحة': 'fan',
                  'راوتر': 'router',
                  'موبايل': 'mobile'
                };

                if (manualReverseItemMappings[cleanItemName]) {
                  translatedItemName = manualReverseItemMappings[cleanItemName];
                  console.log(`✅ Item translated to English (manual): "${cleanItemName}" -> "${translatedItemName}"`);
                } else {
                  console.log(`⚠️ No English translation found for Arabic item: "${cleanItemName}"`);
                }
              }
            } else {
              console.log(`✅ Item already in English: "${cleanItemName}"`);
            }

            const rawNameLocal = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
            const nameObjLocal = (typeof item.name === 'object') ? item.name : { en: rawNameLocal };
            const result = {
              ...item,
              name: translatedItemName,
              nameObj: nameObjLocal,
              categoryName: translatedCategoryName,
              categorySlug: item.categorySlug,
              itemSlug: item.itemSlug || (rawNameLocal ? rawNameLocal.replace(/\s+/g, '-').toLowerCase() : undefined),
            };

            console.log(`Final result - Item: "${result.name}", Category: "${result.categoryName}"`);
            return result;
          });

          console.log("✅ Cart English translation completed");
        } catch (translationError) {
          console.error("❌ Cart English translation failed:", translationError);
        }
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
      nameObj: (typeof name === 'object') ? name : { en: name },
      image,
      points,
      price,
      measurement_unit,
      quantity,
      itemSlug: req.body.itemSlug || (typeof name === 'string' ? name.replace(/\s+/g, '-').toLowerCase() : undefined),
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
          `${safeName(item.name) || item._id}: ${validation.message}`
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

// Debug endpoint for cart translations
export const debugCartTranslations = async (req: Request, res: Response) => {
  try {
    const language = (req.query.lang as "en" | "ar") || "en";
    const testItemName = (req.query.item as string) || "shredded paper";
    const testCategoryName = (req.query.category as string) || "Paper";

    console.log("=== Debug Cart Translations ===");
    console.log("Language:", language);
    console.log("Test item:", testItemName);
    console.log("Test category:", testCategoryName);

    // Special debug for Arabic items
    if (/[\u0600-\u06FF]/.test(testItemName)) {
      console.log("🔍 Special debug for Arabic item:", testItemName);

      // Get Arabic translations to create reverse mapping
      const arabicTranslations = await TranslationService.getTranslations("ar");
      console.log(
        `Retrieved ${
          Object.keys(arabicTranslations).length
        } Arabic translations`
      );

      // Create reverse mapping from Arabic to English
      const reverseTranslations: Record<string, string> = {};
      Object.entries(arabicTranslations).forEach(([key, arabicValue]) => {
        reverseTranslations[arabicValue] = key;
      });

      console.log("🔍 Reverse translations for Arabic items:");
      Object.entries(reverseTranslations).forEach(([arabic, key]) => {
        if (arabic.includes(testItemName) || testItemName.includes(arabic)) {
          console.log(`  "${arabic}" -> "${key}"`);
        }
      });

      // Check if the exact Arabic item exists
      const exactMatch = reverseTranslations[testItemName];
      console.log(`🔍 Exact match for "${testItemName}":`, exactMatch);

      // Check for partial matches
      const partialMatches = Object.keys(reverseTranslations).filter(
        (arabic) =>
          arabic.includes(testItemName) || testItemName.includes(arabic)
      );
      console.log(`🔍 Partial matches for "${testItemName}":`, partialMatches);
    }

    // Test generateKey
    const categoryKey = TranslationService.generateKey(
      testCategoryName,
      "cat",
      "name"
    );
    const itemKey = `item_${testCategoryName}_${testItemName}`;
    console.log("Generated keys:", { categoryKey, itemKey });

    // Test getTranslations
    const translations = await TranslationService.getTranslations(language);
    console.log("Total translations found:", Object.keys(translations).length);
    console.log("Category translation:", translations[categoryKey]);
    console.log("Item translation:", translations[itemKey]);

    // Test alternative keys
    const alternativeKeys = [
      `item_${testCategoryName}_${testItemName.toLowerCase()}`,
      `item_${testCategoryName}_${testItemName.replace(/\s+/g, "_")}`,
      `item_${testCategoryName}_${testItemName.replace(/[^a-zA-Z0-9]/g, "")}`,
      // Also try the generateKey method as fallback
      TranslationService.generateKey(
        `${testCategoryName}_${testItemName}`,
        "item"
      ),
    ];

    console.log("Alternative keys:", alternativeKeys);
    console.log(
      "Alternative translations:",
      alternativeKeys.map((key) => ({ key, translation: translations[key] }))
    );

    // Search for matching keys
    const matchingKeys = Object.keys(translations).filter(
      (key) =>
        key.startsWith("item_") &&
        (translations[key] === testItemName ||
          key.includes(testItemName.toLowerCase()))
    );

    console.log("Matching keys by search:", matchingKeys);
    console.log(
      "Matching translations:",
      matchingKeys.map((key) => ({ key, translation: translations[key] }))
    );

    // Show all item keys in database for debugging
    const allItemKeys = Object.keys(translations).filter((key) =>
      key.startsWith("item_")
    );
    console.log("All item keys in database:", allItemKeys);
    console.log(
      "All item translations:",
      allItemKeys.map((key) => ({ key, translation: translations[key] }))
    );

    res.json({
      language,
      testItem: testItemName,
      testCategory: testCategoryName,
      generatedKeys: { categoryKey, itemKey },
      translations: {
        category: translations[categoryKey],
        item: translations[itemKey],
      },
      alternativeKeys,
      alternativeTranslations: alternativeKeys.map((key) => ({
        key,
        translation: translations[key],
      })),
      matchingKeys,
      matchingTranslations: matchingKeys.map((key) => ({
        key,
        translation: translations[key],
      })),
      totalTranslations: Object.keys(translations).length,
    });
  } catch (error) {
    console.error("Debug cart translations error:", error);
    res.status(500).json({ error: error.message });
  }
};
