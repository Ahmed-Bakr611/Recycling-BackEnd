import { Request, Response } from "express";
import Category from "../models/category";
import { TranslationService } from "../services/translationService";
import { safeName } from "../utils/strings";
import Translation from "../models/translation";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface TranslatedRequest extends Request {
  language?: 'en' | 'ar';
}

interface TranslatedMulterRequest extends MulterRequest {
  language?: 'en' | 'ar';
}

// Helper function to generate slug that matches English name exactly (preserving spaces and original format)
const generateSlug = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  // Keep the name exactly as it is, just trim whitespace
  // This preserves spaces, capitalization, and keeps the original format
  return name.trim();
};

// ======================== ITEM ========================

export const getAllItems = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const role = req.query.role;
    const categoryName = req.query.category as string;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';

    console.log('=== getAllItems Debug ===');
    console.log('Language requested:', language);
    console.log('Category filter:', categoryName);

    let matchStage = {};

    if (categoryName && categoryName !== 'all') {
      const decodedCategoryName = decodeURIComponent(categoryName);
      matchStage = {
        $or: [
          { name: categoryName },
          { name: decodedCategoryName },
          { slug: categoryName },
          { slug: decodedCategoryName }
        ]
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
    let items = await Category.aggregate([
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
  ]) as Array<Record<string, any>>;

    console.log('Found items count:', items.length);
    console.log('Sample item names:', items.map(i => i.name));

    // Normalize items: ensure name is translations object and slug exists
    items = items.map(i => {
      const nameObj = (i.name && typeof i.name === 'object') ? i.name : (i.name ? { en: i.name } : {});
      return {
        ...i,
        name: nameObj,
        slug: i.slug || (nameObj.en ? nameObj.en.replace(/\s+/g, '-').toLowerCase() : i._id)
      };
    });

    // 3. Apply translations if language is Arabic AND we have items
    if (language === 'ar' && items.length > 0) {
      console.log('Starting Arabic translation for items...');
      
      try {
        const translations = await TranslationService.getTranslations(language);
        console.log(`Retrieved ${Object.keys(translations).length} translations`);
        
        items = items.map(item => {
          // Translate item name (item.name is object)
          const rawName = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
          const itemKey = TranslationService.generateKey(`${item.categoryName}_${rawName}`, 'item');
          const translatedItemName = translations[itemKey] || rawName;

          // Translate category name
          const categoryNameKey = TranslationService.generateKey(item.categoryName, 'cat', 'name');
          const translatedCategoryName = translations[categoryNameKey] || item.categoryName;

          console.log(`Translating item: ${rawName} -> ${translatedItemName}`);

          return {
            ...item,
            name: { en: rawName, ar: translatedItemName },
            categoryName: translatedCategoryName
          };
        });
        
        console.log('Item translation completed');
      } catch (translationError) {
        console.error('Item translation failed:', translationError);
        // Continue with original items if translation fails
      }
    } else {
      console.log('Skipping translation - language:', language, 'items:', items.length);
    }

    // 4. Adjust price if role is buyer
    if (role === "buyer") {
      items = items.map(item => ({
        ...item,
        price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
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
    const language = (req.query.lang as 'en' | 'ar') || (req as any).language || 'en';

    console.log("=== getItems Debug ===");
    console.log("Raw param:", rawName);
    console.log("Decoded param:", rawName);
    console.log("Language requested:", language);

    let category: any = null;

    if (language === 'ar') {
      // Step 1: Try to find translation first
      const translationRecord = await TranslationService.findCategoryTranslationByLang(rawName, 'ar');
      if (translationRecord?.referenceId) {
        category = await Category.findById(translationRecord.referenceId).slice("items", [skip, limit]);
        console.log(`Category found by referenceId: ${translationRecord.referenceId}`);
      } else {
        console.log(`No translation found for "${rawName}"`);
      }
    }

    // Step 2: Fallback to original name or slug if no translation
    if (!category) {
      category = await Category.findOne({
        $or: [
          { name: rawName },
          { slug: rawName },
          { slug: encodeURIComponent(rawName) } // Try encoded version too
        ]
      }).slice("items", [skip, limit]);
      console.log(`Category found by name/slug: ${category ? category._id : 'NOT FOUND'}`);
    }

    if (!category) {
      console.log("Category not found");
      return res.status(404).json({ 
        message: "Category not found", 
        searchedFor: rawName,
        encodedSearchTerm: encodeURIComponent(rawName)
      });
    }

    // Get total items count
    const fullCategory = await Category.findById(category._id);
    const totalItems = fullCategory?.items.length || 0;

    let items = Array.isArray(category.items)
      ? category.items.map(item => ({
          ...item.toObject ? item.toObject() : { ...item },
          categoryId: category._id,
          categoryName: category.name,
          categorySlug: category.slug,
        }))
      : [];

    // Translate category & items if Arabic
    if (language === 'ar' && items.length > 0) {
      console.log("Translating items to Arabic...");
      const translated = await TranslationService.translateCategories([{ ...category.toObject(), items }], 'ar');
      items = translated[0].items;
      console.log("Translation completed for items");
    }

    // Adjust price for buyers
    if (role === "buyer") {
      items = items.map(item => ({
        ...item,
        price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
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
    const { itemName, points, price, measurement_unit, quantity, itemNameAr } = req.body;

    console.log('Creating item with data:', { itemName, itemNameAr, categoryName });

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

    // Generate slug for the new item using improved logic
    const itemSlug = generateSlug(itemName);

    const nameObjForNewItem = (typeof itemName === 'object') ? itemName : { en: itemName };
    const item = {
      name: nameObjForNewItem,
      nameObj: nameObjForNewItem,
      slug: itemSlug,
      itemSlug: itemSlug,
      image: req.file.path,
      points: Number(points),
      price: Number(price),
      quantity: Number(quantity),
      measurement_unit: Number(measurement_unit),
    };

    // Find category by name or slug
    const decodedCategoryName = decodeURIComponent(categoryName);
    const updatedCategory = await Category.findOneAndUpdate(
      {
        $or: [
          { name: decodedCategoryName },
          { slug: categoryName },
          { slug: decodedCategoryName }
        ]
      },
      { $push: { items: item } },
      { new: true }
    );

    if (!updatedCategory) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    // Create translation for the new item (only if Arabic translation provided)
    if (itemNameAr) {
      try {
        const newItem = updatedCategory.items[updatedCategory.items.length - 1];
        console.log('Creating item translation...');
        const itemKey = await TranslationService.createItemTranslation(
          itemName,
          updatedCategory.name, // Use actual category name
          itemNameAr,
          newItem._id?.toString()
        );
        console.log(`Item translation created with key: ${itemKey}`);
      } catch (translationError) {
        console.error('Error creating item translation:', translationError);
        // Don't fail the request if translation creation fails
      }
    } else {
      console.log('No Arabic translation provided for item, skipping translation creation');
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    console.error('Error creating item:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const updateItem = async (
  req: TranslatedMulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const { name, points, price, measurement_unit, quantity, nameAr } = req.body;
    const image = req.file?.path;
    const decodedCategoryName = decodeURIComponent(categoryName);

    console.log('Updating item with data:', { name, nameAr, categoryName: decodedCategoryName, itemId });
    
    const category = await Category.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${decodedCategoryName}$`, 'i') } },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });
    
    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

  const oldItemNameRaw = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;

    // Update item properties
    if (name) {
      const nameObjUpdated = (typeof name === 'object') ? name : { en: name };
      item.name = nameObjUpdated;
      item.nameObj = nameObjUpdated;
      item.slug = generateSlug(nameObjUpdated.en || String(nameObjUpdated)); // Update slug when name changes
      item.itemSlug = item.slug;
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

    // Update translation if Arabic translation provided
    if (nameAr) {
      try {
        console.log('Updating item translation...');
        const itemKey = await TranslationService.createItemTranslation(
          name || oldItemNameRaw,
          category.name,
          nameAr,
          itemId
        );
        console.log(`Item translation updated with key: ${itemKey}`);
      } catch (translationError) {
        console.error('Error updating item translation:', translationError);
        // Don't fail the request if translation update fails
      }
    } else {
      console.log('No Arabic translation provided for update, skipping translation update');
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
    const decodedCategoryName = decodeURIComponent(categoryName);
    
    const category = await Category.findOne({
      $or: [
        { name: decodedCategoryName },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });

    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const itemNameVal = item.name;
    const rawItemName = (typeof itemNameVal === 'object') ? (itemNameVal.en || Object.values(itemNameVal)[0]) : itemNameVal;

    category.items.pull(itemId);
    await category.save();

    // Clean up item translation
    try {
      const itemKey = TranslationService.generateKey(`${category.name}_${rawItemName}`, 'item');
      await Translation.deleteOne({ key: itemKey });
      console.log(`Deleted translation for item key: ${itemKey}`);
    } catch (translationError) {
      console.error('Error deleting item translation:', translationError);
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

// Get item by name (preserves existing functionality)
export const getItemByName = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemName } = req.params;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';
    const decodedCategoryName = decodeURIComponent(categoryName);
    const decodedItemName = decodeURIComponent(itemName);

    console.log('=== getItemByName Debug ===');
    console.log('Category:', decodedCategoryName, 'ItemName:', decodedItemName);
    console.log('Language requested:', language);

    // Find category by name or slug
    const category = await Category.findOne({
      $or: [
        { name: decodedCategoryName },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });

    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    // Find item by name or slug/itemSlug. Handle legacy `name` which may be string or translations object.
    const item = category.items.find((it: any) => {
      const itNameVal = it.name;
      const nameStr = (typeof itNameVal === 'object') ? (itNameVal.en || Object.values(itNameVal)[0]) : itNameVal;
      const derivedSlug = it.itemSlug || it.slug || (nameStr ? String(nameStr).trim().replace(/\s+/g, '-').toLowerCase() : undefined);

      return (
        // match by decoded item name (exact)
        (nameStr && nameStr === decodedItemName) ||
        // match by slug (both param and decoded param)
        it.slug === itemName || it.slug === decodedItemName ||
        (it.itemSlug === itemName) || (it.itemSlug === decodedItemName) ||
        // also allow derived slug match
        derivedSlug === itemName || derivedSlug === decodedItemName
      );
    });

    if (!item) {
      res.status(404).json({ 
        message: "Item not found",
        searchedFor: itemName,
        decodedName: decodedItemName
      });
      return;
    }

    // Normalize name and slug for response
    const rawName = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
    let itemResponse: any = {
      ...item.toObject(),
      name: (typeof item.name === 'object') ? item.name : { en: rawName },
      slug: item.slug || (rawName ? rawName.replace(/\s+/g, '-').toLowerCase() : item._id),
      categoryName: category.name,
      categorySlug: category.slug,
      categoryId: category._id
    };

    // Apply translations if language is Arabic
    if (language === 'ar') {
      console.log('Starting Arabic translation for single item...');
      
      try {
        const translations = await TranslationService.getTranslations(language);
        
  // Translate item name
  const itemKey = TranslationService.generateKey(`${category.name}_${rawName}`, 'item');
  const translatedItemName = translations[itemKey] || rawName;
        
        // Translate category name
        const categoryNameKey = TranslationService.generateKey(category.name, 'cat', 'name');
        const translatedCategoryName = translations[categoryNameKey] || category.name;
        
  console.log(`Translating single item: ${safeName(item.name)} -> ${translatedItemName}`);
        
        itemResponse = {
          ...itemResponse,
          name: { en: rawName, ar: translatedItemName },
          categoryName: translatedCategoryName
        };
        
        console.log('Single item translation completed');
      } catch (translationError) {
        console.error('Single item translation failed:', translationError);
        // Continue with original item if translation fails
      }
    } else {
      console.log('Skipping translation for single item - language:', language);
    }

    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemByName error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// Get item by slug (new functionality)
export const getItemBySlug = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemSlug } = req.params;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';
    const decodedCategoryName = decodeURIComponent(categoryName);
    const decodedItemSlug = decodeURIComponent(itemSlug);

    console.log('=== getItemBySlug Debug ===');
    console.log('Category:', decodedCategoryName, 'ItemSlug:', decodedItemSlug);
    console.log('Language requested:', language);

    // Find category by name or slug
    const category = await Category.findOne({
      $or: [
        { name: decodedCategoryName },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });

    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    // Find item by slug (try both encoded and decoded versions)
    const item = category.items.find((item: any) => 
      item.slug === itemSlug || item.slug === decodedItemSlug
    );

    if (!item) {
      res.status(404).json({ 
        message: "Item not found",
        searchedFor: itemSlug,
        decodedSlug: decodedItemSlug
      });
      return;
    }

    const rawName2 = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
    let itemResponse = {
      ...item.toObject(),
      name: (typeof item.name === 'object') ? item.name : { en: rawName2 },
      slug: item.slug || (rawName2 ? rawName2.replace(/\s+/g, '-').toLowerCase() : item._id),
      categoryName: category.name,
      categorySlug: category.slug,
      categoryId: category._id
    };

    // Apply translations if language is Arabic
    if (language === 'ar') {
      console.log('Starting Arabic translation for single item...');
      
      try {
        const translations = await TranslationService.getTranslations(language);
        
  // Translate item name
  const itemKey = TranslationService.generateKey(`${category.name}_${rawName2}`, 'item');
  const translatedItemName = translations[itemKey] || rawName2;
        
        // Translate category name
        const categoryNameKey = TranslationService.generateKey(category.name, 'cat', 'name');
        const translatedCategoryName = translations[categoryNameKey] || category.name;
        
  console.log(`Translating single item: ${safeName(item.name)} -> ${translatedItemName}`);
        
        itemResponse = {
          ...itemResponse,
          name: { en: rawName2, ar: translatedItemName },
          categoryName: translatedCategoryName
        };
        
        console.log('Single item translation completed');
      } catch (translationError) {
        console.error('Single item translation failed:', translationError);
        // Continue with original item if translation fails
      }
    } else {
      console.log('Skipping translation for single item - language:', language);
    }

    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemBySlug error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// Keep the original getItemById for backward compatibility
export const getItemById = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';
    const decodedCategoryName = decodeURIComponent(categoryName);

    console.log('=== getItemById Debug ===');
    console.log('Category:', decodedCategoryName, 'ItemId:', itemId);
    console.log('Language requested:', language);

    const category = await Category.findOne({
      $or: [
        { name: decodedCategoryName },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });

    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const rawName3 = (typeof item.name === 'object') ? (item.name.en || Object.values(item.name)[0]) : item.name;
    let itemResponse = {
      ...item.toObject(),
      name: (typeof item.name === 'object') ? item.name : { en: rawName3 },
      slug: item.slug || (rawName3 ? rawName3.replace(/\s+/g, '-').toLowerCase() : item._id),
      categoryName: category.name,
      categorySlug: category.slug,
      categoryId: category._id
    };

    // Apply translations if language is Arabic
    if (language === 'ar') {
      console.log('Starting Arabic translation for single item...');
      
      try {
        const translations = await TranslationService.getTranslations(language);
        
  // Translate item name
  const itemKey = TranslationService.generateKey(`${category.name}_${rawName3}`, 'item');
  const translatedItemName = translations[itemKey] || rawName3;
        
        // Translate category name
        const categoryNameKey = TranslationService.generateKey(category.name, 'cat', 'name');
        const translatedCategoryName = translations[categoryNameKey] || category.name;
        
  console.log(`Translating single item: ${safeName(item.name)} -> ${translatedItemName}`);
        
        itemResponse = {
          ...itemResponse,
          name: { en: rawName3, ar: translatedItemName },
          categoryName: translatedCategoryName
        };
        
        console.log('Single item translation completed');
      } catch (translationError) {
        console.error('Single item translation failed:', translationError);
        // Continue with original item if translation fails
      }
    } else {
      console.log('Skipping translation for single item - language:', language);
    }

    res.status(200).json(itemResponse);
  } catch (err) {
    console.error("getItemById error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// Check current item translations (debugging helper)
export const checkItemTranslations = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    const itemTranslations = await Translation.find({ type: 'item' }).lean();
    
    res.json({
      total: itemTranslations.length,
      translations: itemTranslations.map(t => ({
        key: t.key,
        en: t.translations.en,
        ar: t.translations.ar,
        type: t.type,
        referenceId: t.referenceId
      }))
    });
  } catch (error) {
    console.error('Error checking item translations:', error);
    res.status(500).json({ error: error.message });
  }
};