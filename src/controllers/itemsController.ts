import { Request, Response } from "express";
import Category from "../models/category";
import { TranslationService } from "../services/translationService";
import Translation from "../models/translation";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface TranslatedRequest extends Request {
  language?: "en" | "ar";
}

interface TranslatedMulterRequest extends MulterRequest {
  language?: "en" | "ar";
}

// Helper function to generate slug that matches the normalized format
const generateSlug = (name: string): string => {
  if (!name || typeof name !== "string") return "";
  return TranslationService.normalizeText(name);
};

// ======================== ITEM ========================

export const getAllItems = async (req: any, res: Response): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const role = req.query.role;
    const categoryName = req.query.category as string;
    const language = (req.query.lang as "en" | "ar") || req.language || "en";

    console.log("=== getAllItems Debug ===");
    console.log("Language requested:", language);
    console.log("Category filter:", categoryName);

    let matchStage = {};

    if (categoryName && categoryName !== "all") {
      // Normalize the category name for consistent matching
      const normalizedCategory = TranslationService.normalizeText(
        decodeURIComponent(categoryName)
      );
      matchStage = {
        $or: [{ name: normalizedCategory }, { slug: normalizedCategory }],
      };
    }

    // 1. Count total items
    const totalAggregation = await Category.aggregate([
      { $match: matchStage },
      { $project: { itemCount: { $size: "$items" } } },
      { $group: { _id: null, totalItems: { $sum: "$itemCount" } } },
    ]);
    const totalItems = totalAggregation[0]?.totalItems || 0;

    // 2. Paginate items within matched categories
    let items = (await Category.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: "$items._id",
          name: "$items.name",
          slug: "$items.slug",
          points: "$items.points",
          price: "$items.price",
          measurement_unit: "$items.measurement_unit",
          image: "$items.image",
          quantity: "$items.quantity",
          categoryName: "$name",
          categorySlug: "$slug",
          categoryId: "$_id",
        },
      },
    ])) as Array<Record<string, any>>;

    console.log("Found items count:", items.length);

    // 3. Apply translations using your translation service
    if (items.length > 0) {
      try {
        // Get all unique categories for translation
        const uniqueCategories = await Category.find({
          _id: { $in: items.map((item) => item.categoryId) },
        }).lean();

        // Use your translation service
        const translatedCategories =
          await TranslationService.translateCategories(
            uniqueCategories,
            language
          );

        // Create lookup maps
        const categoryMap = new Map();
        const itemMap = new Map();

        translatedCategories.forEach((cat) => {
          categoryMap.set(cat._id.toString(), {
            name: cat.name,
            displayName: cat.displayName || cat.name,
          });

          if (cat.items) {
            cat.items.forEach((item) => {
              if (item._id) {
                itemMap.set(item._id.toString(), {
                  name: item.name,
                  displayName: item.displayName || item.name,
                });
              }
            });
          }
        });

        // Apply translations to items
        items = items.map((item) => {
          const categoryInfo = categoryMap.get(item.categoryId?.toString());
          const itemInfo = itemMap.get(item._id?.toString());

          return {
            ...item,
            name: item.name, // Keep normalized name
            displayName: itemInfo?.displayName || item.name, // Add display name
            categoryName: item.categoryName, // Keep normalized category name
            categoryDisplayName: categoryInfo?.displayName || item.categoryName, // Add category display name
          };
        });

        console.log(
          "Translation completed using normalized TranslationService"
        );
      } catch (translationError) {
        console.error("Translation failed:", translationError);
      }
    }

    // 4. Adjust price if role is buyer
    if (role === "buyer") {
      items = items.map((item) => ({
        ...item,
        price: item.price
          ? Math.round(item.price * 1.5 * 100) / 100
          : item.price,
      }));
    }

    res.paginated(items, totalItems);
  } catch (err) {
    console.error("getAllItems error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItems = async (req: Request, res: Response) => {
  try {
    const rawName = decodeURIComponent(req.params.categoryName);
    const { skip, limit } = req.pagination || { skip: 0, limit: 10 };
    const role = req.query.role as string | undefined;
    const language =
      (req.query.lang as "en" | "ar") || (req as any).language || "en";

    console.log("=== getItems Debug ===");
    console.log("Raw param:", rawName);
    console.log("Language requested:", language);

    let category: any = null;

    // Use your translation service to find the right category
    const translationRecord = await TranslationService.getTheRightTrnslation(
      rawName,
      "category"
    );

    if (translationRecord?.referenceId) {
      category = await Category.findById(translationRecord.referenceId).slice(
        "items",
        [skip, limit]
      );
      console.log(
        `Category found by translation referenceId: ${translationRecord.referenceId}`
      );
    }

    // Fallback to normalized search
    if (!category) {
      const normalizedName = TranslationService.normalizeText(rawName);
      category = await Category.findOne({
        $or: [{ name: normalizedName }, { slug: normalizedName }],
      }).slice("items", [skip, limit]);
      console.log(
        `Category found by normalized name: ${
          category ? category._id : "NOT FOUND"
        }`
      );
    }

    if (!category) {
      console.log("Category not found");
      return res.status(404).json({
        message: "Category not found",
        searchedFor: rawName,
      });
    }

    // Get total items count
    const fullCategory = await Category.findById(category._id);
    const totalItems = fullCategory?.items.length || 0;

    let items = Array.isArray(category.items)
      ? category.items.map((item) => ({
          ...(item.toObject ? item.toObject() : { ...item }),
          categoryId: category._id,
          categoryName: category.name,
          categorySlug: category.slug,
        }))
      : [];

    // Get translated category name for the correct language
    let translatedCategoryName = category.name; // Default to normalized name
    try {
      translatedCategoryName = await TranslationService.getCategoryTranslation(
        category.name, // normalized category name
        language
      );
      console.log(
        `Category translation: ${category.name} -> ${translatedCategoryName}`
      );
    } catch (translationError) {
      console.error("Category translation failed:", translationError);
    }

    // Translate items if needed
    if (items.length > 0) {
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // Get translated item name
          const translatedItemName =
            await TranslationService.getItemTranslation(
              item.name, // normalized item name
              category.name, // normalized category name
              language
            );

          // Update item with translations
          items[i] = {
            ...item,
            categoryName: translatedCategoryName, // Keep normalized name for consistency
            categorySlug: category.slug,
            // Translated category name for UI
            name: translatedItemName, // Translated item name for UI
          };

          console.log(
            `Item translation: ${item.name} -> ${translatedItemName}`
          );
        }

        console.log(
          "Item translation completed using TranslationService methods"
        );
      } catch (translationError) {
        console.error("Item translation failed:", translationError);
        // Add fallback display names if translation fails
        items = items.map((item) => ({
          ...item,
          categoryName: translatedCategoryName,
          name: item.name,
        }));
      }
    }

    // Adjust price for buyers
    if (role === "buyer") {
      items = items.map((item) => ({
        ...item,
        price: item.price
          ? Math.round(item.price * 1.5 * 100) / 100
          : item.price,
      }));
    }

    console.log(`Final items to return: ${items.length}`);
    res.paginated(items, totalItems);
  } catch (err) {
    console.error("getItems error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const addItem = async (
  req: TranslatedMulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { itemName, points, price, measurement_unit, quantity, itemNameAr } =
      req.body;

    console.log("Creating item with data:", {
      itemName,
      itemNameAr,
      categoryName,
    });

    if (!req.file) {
      res.status(400).json({ message: "Image is required" });
      return;
    }

    if (!quantity || isNaN(quantity)) {
      res
        .status(400)
        .json({ message: "Quantity is required and must be a number" });
      return;
    }

    // Generate normalized slug for the item
    const normalizedItemName = TranslationService.normalizeText(itemName);

    const item = {
      name: normalizedItemName, // Store normalized name in database
      slug: normalizedItemName, // Same as name
      image: req.file.path,
      points: Number(points),
      price: Number(price),
      quantity: Number(quantity),
      measurement_unit: Number(measurement_unit),
    };

    // Find category by normalized name
    const normalizedCategoryName = categoryName;
    const updatedCategory = await Category.findOneAndUpdate(
      {
        $or: [
          { name: normalizedCategoryName },
          { slug: normalizedCategoryName },
        ],
      },
      { $push: { items: item } },
      { new: true }
    );

    if (!updatedCategory) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    // Create translation using your translation service
    if (itemNameAr) {
      try {
        const newItem = updatedCategory.items[updatedCategory.items.length - 1];

        // Use your translation service method
        const translationResult =
          await TranslationService.createItemTranslation(
            itemName, // Display name (original format)
            updatedCategory.name, // Category normalized name (already normalized in DB)
            itemNameAr, // Arabic display name
            newItem._id?.toString()
          );

        console.log(`Item translation created:`, translationResult);
      } catch (translationError) {
        console.error("Error creating item translation:", translationError);
      }
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const updateItem = async (
  req: TranslatedMulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const { name, points, price, measurement_unit, quantity, nameAr } =
      req.body;
    const image = req.file?.path;
    const normalizedCategoryName = categoryName;

    console.log("Updating item with data:", {
      name,
      nameAr,
      normalizedCategoryName,
      itemId,
    });

    const category = await Category.findOne({
      $or: [{ name: normalizedCategoryName }, { slug: normalizedCategoryName }],
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    await TranslationService.createOrUpdateTranslation(
      item.slug,
      {
        en: name,
        ar: nameAr,
      },
      "item"
    );

    // Update item properties with normalized values
    if (name) {
      const normalizedItemName = TranslationService.normalizeText(name);
      item.name = normalizedItemName; // Store normalized name
      item.slug = normalizedItemName; // Same as name
      await Translation.findOneAndUpdate(
        { referenceId: item.id },
        { key: normalizedItemName },
        { new: true }
      );
    }
    if (points) item.points = Number(points);
    if (price) item.price = Number(price);
    if (quantity !== undefined) item.quantity = Number(quantity);

    const unit = Number(measurement_unit);
    if (unit === 1 || unit === 2) {
      item.measurement_unit = unit;
    } else if (measurement_unit !== undefined) {
      res.status(400).json({ message: "measurement_unit must be 1 or 2" });
      return;
    }

    if (image) item.image = image;

    await category.save();

    // Update translation using your translation service
    if (nameAr && name) {
      try {
        const translationResult =
          await TranslationService.createItemTranslation(
            name, // Display name (original format)
            category.name, // Category normalized name (already normalized in DB)
            nameAr, // Arabic display name
            itemId
          );

        console.log(`Item translation updated:`, translationResult);
      } catch (translationError) {
        console.error("Error updating item translation:", translationError);
      }
    }

    res.status(200).json({ message: "Item updated successfully", item });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const normalizedCategoryName = categoryName;

    const category = await Category.findOne({
      $or: [{ name: normalizedCategoryName }, { slug: normalizedCategoryName }],
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const itemNormalizedName = item.name; // Should already be normalized in DB

    category.items.pull(itemId);
    await category.save();

    // Clean up translation
    try {
      const itemKey = `item_${category.name}_${itemNormalizedName}`;
      await Translation.deleteOne({ key: itemKey });
      console.log(`Deleted translation for item key: ${itemKey}`);
    } catch (translationError) {
      console.error("Error deleting item translation:", translationError);
    }

    res.status(200).json({
      message: "Item deleted successfully",
      updatedCategory: category,
    });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// Helper function to get single item with translation using your service
const getSingleItemWithTranslation = async (
  category: any,
  item: any,
  language: "en" | "ar"
) => {
  let itemResponse = {
    ...item.toObject(),
    categoryName: category.name, // Normalized name
    categorySlug: category.slug,
    categoryId: category._id,
  };

  try {
    const categoryWithItems = {
      ...category.toObject(),
      items: [item],
    };

    const translatedCategories = await TranslationService.translateCategories(
      [categoryWithItems],
      language
    );

    if (translatedCategories[0]?.items?.[0]) {
      const translatedItem = translatedCategories[0].items[0];
      const translatedCategory = translatedCategories[0];

      itemResponse = {
        ...itemResponse,
        name: item.name, // Keep normalized name
        displayName: translatedItem.displayName || item.name, // Add display name
        categoryName: category.name, // Keep normalized name
        categoryDisplayName: translatedCategory.displayName || category.name, // Add category display name
      };
    }
  } catch (translationError) {
    console.error("Single item translation failed:", translationError);
  }

  return itemResponse;
};

export const getItemByName = async (req: any, res: Response): Promise<void> => {
  try {
    const { categoryName, itemName } = req.params;
    const language = (req.query.lang as "en" | "ar") || req.language || "en";
    const normalizedCategoryName = categoryName;
    const normalizedItemName = TranslationService.normalizeText(
      decodeURIComponent(itemName)
    );

    console.log("=== getItemByName Debug ===");
    console.log("Normalized category:", normalizedCategoryName);
    console.log("Normalized item:", normalizedItemName);
    console.log("Language requested:", language);

    const category = await Category.findOne({
      $or: [{ name: normalizedCategoryName }, { slug: normalizedCategoryName }],
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    const item = category.items.find(
      (item: any) =>
        item.name === normalizedItemName || item.slug === normalizedItemName
    );

    if (!item) {
      res.status(404).json({
        message: "Item not found",
        searchedFor: itemName,
        normalizedName: normalizedItemName,
      });
      return;
    }

    const itemResponse = await getSingleItemWithTranslation(
      category,
      item,
      language
    );
    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemByName error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItemBySlug = async (req: any, res: Response): Promise<void> => {
  try {
    const { categoryName, itemSlug } = req.params;
    const language = (req.query.lang as "en" | "ar") || req.language || "en";
    const normalizedCategoryName = categoryName;
    const normalizedItemSlug = TranslationService.normalizeText(
      decodeURIComponent(itemSlug)
    );

    console.log("=== getItemBySlug Debug ===");
    console.log("Normalized category:", normalizedCategoryName);
    console.log("Normalized item slug:", normalizedItemSlug);
    console.log("Language requested:", language);

    const category = await Category.findOne({
      $or: [{ name: normalizedCategoryName }, { slug: normalizedCategoryName }],
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    const item = category.items.find(
      (item: any) =>
        item.slug === normalizedItemSlug || item.name === normalizedItemSlug
    );

    if (!item) {
      res.status(404).json({
        message: "Item not found",
        searchedFor: itemSlug,
        normalizedSlug: normalizedItemSlug,
      });
      return;
    }

    const itemResponse = await getSingleItemWithTranslation(
      category,
      item,
      language
    );
    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemBySlug error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItemById = async (req: any, res: Response): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const language = (req.query.lang as "en" | "ar") || req.language || "en";
    const normalizedCategoryName = categoryName;

    console.log("=== getItemById Debug ===");
    console.log("Normalized category:", normalizedCategoryName);
    console.log("ItemId:", itemId);
    console.log("Language requested:", language);

    const category = await Category.findOne({
      $or: [{ name: normalizedCategoryName }, { slug: normalizedCategoryName }],
    });

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedName: normalizedCategoryName,
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const itemResponse = await getSingleItemWithTranslation(
      category,
      item,
      language
    );
    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemById error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const checkItemTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const itemTranslations = await Translation.find({ type: "item" }).lean();

    res.json({
      total: itemTranslations.length,
      translations: itemTranslations.map((t) => ({
        key: t.key,
        en: t.translations.en,
        ar: t.translations.ar,
        type: t.type,
        referenceId: t.referenceId,
      })),
    });
  } catch (error) {
    console.error("Error checking item translations:", error);
    res.status(500).json({ error: error.message });
  }
};
