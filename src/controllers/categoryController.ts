import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import { TranslationService } from "../services/translationService";
import Translation from "../models/translation";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface TranslatedRequest extends Request {
  language?: 'en' | 'ar';
}

// Helper function to generate slug that matches English name exactly (preserving spaces and original format)
const generateSlug = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  // Keep the name exactly as it is, just trim whitespace
  // This preserves spaces, capitalization, and keeps the original format
  return name.trim();
};

// Alternative: If you want to use underscores instead of URL encoding
const generateSlugWithUnderscores = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
};

// Alternative: If you want to keep exactly as the name but make it URL-safe
const generateSlugExact = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  // This will preserve the exact text but encode special characters for URLs
  return encodeURIComponent(name.trim());
};

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, nameAr, descriptionAr } = req.body;
    const image = req.file?.path ?? "";

    // Create category with improved slug generation
    const category = new Category({ 
      name, 
      description, 
      image, 
      items: [],
      slug: generateSlug(name) // Using the new slug generation
    });

    await category.save();

    // Rest of your translation logic remains the same
    if (nameAr || descriptionAr) {
      await TranslationService.createCategoryTranslations(
        name,
        description,
        nameAr,
        descriptionAr,
        category._id.toString()
      );
    }

    res.status(201).json(category);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(400).json({ message: (err as Error).message });
  }
};

export const getAllCategories = async (
  req: TranslatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const language = req.language || req.query.lang as 'en' | 'ar' || 'en';

    // Get paginated results (your existing logic)
    const [categories, total] = await Promise.all([
      Category.find().skip(skip).limit(limit).lean(),
      Category.countDocuments(),
    ]);

    // Translate if language is not English
    const finalCategories = language === 'en' 
      ? categories 
      : await TranslationService.translateCategories(categories, language);

    res.paginated(finalCategories, total);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoriesWithPagination = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const role = req.query.role;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';
    const pagination = req.pagination || { skip: 0, limit: 10, page: 1 };
    
    console.log('=== getCategoriesWithPagination Debug ===');
    console.log('Language requested:', language);
    console.log('Req.language from middleware:', req.language);
    console.log('Query lang param:', req.query.lang);

    // Your existing pagination logic
    const [categories, total] = await Promise.all([
      Category.find().skip(pagination.skip).limit(pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    console.log('Found categories count:', categories.length);
    console.log('Sample category names:', categories.map(c => c.name));

    // IMPORTANT: Only translate if language is Arabic AND we have categories
    let processedCategories = categories;
    
    if (language === 'ar' && categories.length > 0) {
      console.log('Starting Arabic translation...');
      
      try {
        processedCategories = await TranslationService.translateCategories(categories, language);
        console.log('Translation completed');
        console.log('Translated sample names:', processedCategories.map(c => c.name));
      } catch (translationError) {
        console.error('Translation failed:', translationError);
        processedCategories = categories;
      }
    } else {
      console.log('Skipping translation - language:', language, 'categories:', categories.length);
    }

    // Your existing role-based pricing logic
    if (role === "buyer") {
      processedCategories = processedCategories.map(category => {
        const plainCategory = typeof category.toObject === "function" ? category.toObject() : category;
        return {
          ...plainCategory,
          items: Array.isArray(plainCategory.items)
            ? plainCategory.items.map((item: any) => ({
                ...item,
                price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
              }))
            : [],
        };
      });
    }

    res.json({
      success: true,
      data: processedCategories,
      pagination: {
        currentPage: pagination.page,
        itemsPerPage: pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.skip + pagination.limit < total,
      },
    });
  } catch (error) {
    console.error('Error in getCategoriesWithPagination:', error);
    res.status(500).json({ error: "Server error" });
  }
};

export const createCategoryWithImage = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name, description, itemName, points, price, measurement_unit,
      nameAr, descriptionAr, itemNameAr
    } = req.body;

    // Create category with improved slug
    const newCategory = new Category({
      name,
      description,
      image: req.file?.path ?? "",
      items: [
        {
          name: itemName,
          slug: generateSlug(itemName), // Add slug for item too
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
          categoryName: name
        },
      ],
      slug: generateSlug(name) // Add slug for category
    });

    await newCategory.save();

    // Create translations
    await TranslationService.createCategoryTranslations(
      name,
      description,
      nameAr,
      descriptionAr,
      newCategory._id.toString()
    );

    // Create item translation
    const itemId = newCategory.items[0]._id?.toString();
    await TranslationService.createItemTranslation(
      itemName,
      name,
      itemNameAr,
      itemId
    );

    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const updatedCategory = async (
  req: MulterRequest,
  res: Response
): Promise<Response> => {
  try {
    const { categoryName } = req.params;
    const { name, description, image: imageFromBody, nameAr, descriptionAr } = req.body;
    const imageFromFile = req.file?.path;

    // Find by slug or name with URL decoding for slug matching
    const decodedCategoryName = decodeURIComponent(categoryName);
    const category = await Category.findOne({
      $or: [
        { slug: categoryName }, // Try original (might be encoded)
        { slug: decodedCategoryName }, // Try decoded
        { name: { $regex: new RegExp(`^${decodedCategoryName}$`, 'i') } }
      ]
    });

    if (!category) {
      return res.status(404).json({ 
        message: "Category not found",
        searchedName: categoryName,
        decodedName: decodedCategoryName,
        suggestion: "Check if the category name is correct and try again"
      });
    }

    // Store original values for translation updates
    const originalValues = {
      name: category.name,
      description: category.description
    };

    // Handle English updates
    if (name !== undefined) {
      if (name !== category.name) {
        category.name = name;
        category.slug = generateSlug(name); // Update slug with new logic
        
        // Update category name in all items
        category.items.forEach((item) => {
          item.categoryName = name;
        });
      }
    }

    if (description !== undefined) {
      category.description = description;
    }

    // Handle image update
    if (imageFromFile) {
      category.image = imageFromFile;
    } else if (imageFromBody !== undefined) {
      category.image = imageFromBody;
    }

    // Save the category updates first
    const updatedCategory = await category.save();

    // Handle translations (only update provided fields)
    const translationUpdates: Record<string, any> = {};
    
    if (nameAr !== undefined) {
      translationUpdates['translations.ar.name'] = nameAr;
    }
    
    if (descriptionAr !== undefined) {
      translationUpdates['translations.ar.description'] = descriptionAr;
    }

    // Only update translations if there are changes
    if (Object.keys(translationUpdates).length > 0) {
      await TranslationService.createCategoryTranslations(
        name !== undefined ? category.name : originalValues.name,
        description !== undefined ? category.description : originalValues.description,
        nameAr,
        descriptionAr,
        category._id.toString()
      );
    }

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory
    });
  } catch (err) {
    console.error("Update category error:", err);
    return res.status(500).json({ 
      message: "Failed to update category",
      error: (err as Error).message 
    });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const decodedCategoryName = decodeURIComponent(categoryName);
    
    const deleted = await Category.findOneAndDelete({
      $or: [
        { name: decodedCategoryName },
        { slug: categoryName },
        { slug: decodedCategoryName }
      ]
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Clean up related translations
    const nameKey = TranslationService.generateKey(deleted.name, 'cat', 'name');
    const descKey = TranslationService.generateKey(deleted.name, 'cat', 'desc');
    
    // Create array of item translation keys
    const itemTranslationPromises = deleted.items.map(item => {
      const itemKey = TranslationService.generateKey(`${deleted.name}_${item.name}`, 'item');
      return Translation.deleteOne({ key: itemKey });
    });

    await Promise.all([
      Translation.deleteOne({ key: nameKey }),
      Translation.deleteOne({ key: descKey }),
      ...itemTranslationPromises
    ]);

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoryByName = async (
  req: TranslatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const language = req.query.lang as 'en' | 'ar' || 'en';
    const decodedCategoryName = decodeURIComponent(categoryName);

    // Search by either slug or name with URL decoding
    const category = await Category.findOne({
      $or: [
        { slug: categoryName },
        { slug: decodedCategoryName },
        { name: decodedCategoryName }
      ]
    }).lean();

    if (!category) {
      res.status(404).json({ 
        message: "Category not found",
        searchedFor: categoryName,
        decodedName: decodedCategoryName
      });
      return;
    }

    const finalCategory = language === 'en' 
      ? category 
      : (await TranslationService.translateCategories([category], language))[0];

    res.status(200).json(finalCategory);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const migrateExistingSlugs = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Starting slug migration...');
    
    const categories = await Category.find();
    let updatedCount = 0;
    
    for (const category of categories) {
      const newSlug = category.name.trim(); // New slug logic
      
      if (category.slug !== newSlug) {
        console.log(`Updating "${category.name}": "${category.slug}" -> "${newSlug}"`);
        
        category.slug = newSlug;
        
        // Update item slugs too
        if (category.items && category.items.length > 0) {
          category.items.forEach(item => {
            if (item.name) {
              item.slug = item.name.trim();
            }
          });
        }
        
        await category.save();
        updatedCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} categories`,
      updatedCount 
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const seedMissingCategoryTranslations = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find().lean();
    const createdKeys: string[] = [];
    const skippedKeys: string[] = [];

    for (const category of categories) {
      if (!category.name) continue;

      const nameKey = TranslationService.generateKey(category.name, 'cat', 'name');
      const descKey = TranslationService.generateKey(category.name, 'cat', 'desc');

      // Check if name translation exists
      const existingName = await Translation.findOne({ key: nameKey });
      if (!existingName) {
        await TranslationService.createOrUpdateTranslation(
          nameKey,
          { en: category.name, ar: category.name }, // placeholder Arabic
          'category',
          category._id.toString()
        );
        createdKeys.push(nameKey);
      } else {
        skippedKeys.push(nameKey);
      }

      // Check if description translation exists
      const existingDesc = await Translation.findOne({ key: descKey });
      if (!existingDesc) {
        await TranslationService.createOrUpdateTranslation(
          descKey,
          { en: category.description || '', ar: category.description || '' },
          'category',
          category._id.toString()
        );
        createdKeys.push(descKey);
      } else {
        skippedKeys.push(descKey);
      }
    }

    return res.json({
      success: true,
      message: 'Category translations seeding complete.',
      createdKeys,
      skippedKeys
    });
  } catch (err) {
    console.error('Error seeding category translations:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};



export const getCategoryByNameForAdmin = async (req: Request, res: Response) => {
  try {
    const rawName = req.params.categoryName;
    const decodedName = decodeURIComponent(rawName)
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ');

    console.log('Searching for category name:', decodedName);

    // First find translation documents that match the name
    const translationDocs = await Translation.find({
      $or: [
        { 'translations.ar': decodedName }, // Match Arabic translation
        { 'translations.en': decodedName }, // Match English translation
      ],
      key: { $regex: /_name$/ } // Only look at name fields (not descriptions)
    });

    if (!translationDocs || translationDocs.length === 0) {
      return res.status(404).json({
        message: 'Category translation not found',
        searchedFor: decodedName,
      });
    }

    // Get all reference IDs from matching translations
    const categoryIds = translationDocs.map(doc => doc.referenceId);

    // Find the actual categories using these IDs
    const categories = await Category.find({
      _id: { $in: categoryIds }
    });

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        message: 'Categories not found for matching translations',
        searchedFor: decodedName,
        translationMatches: translationDocs
      });
    }

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error('getCategoryByName error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};
// New endpoints for translation management
export const getTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = req.query.lang as 'en' | 'ar' || 'en';
    const translations = await TranslationService.getTranslations(language);
    
    res.json({
      success: true,
      data: translations,
      language
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getMissingTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const missing = await TranslationService.getMissingTranslations();
    
    res.json({
      success: true,
      data: missing
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createTranslation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { key, translations, type, referenceId } = req.body;

    const translation = await TranslationService.createOrUpdateTranslation(
      key,
      translations,
      type,
      referenceId
    );

    res.status(201).json({
      success: true,
      data: translation
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const checkCurrentTranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const allTranslations = await Translation.find().lean();
    
    res.json({
      total: allTranslations.length,
      translations: allTranslations.map(t => ({
        key: t.key,
        en: t.translations.en,
        ar: t.translations.ar,
        type: t.type
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Debug endpoint to test translation service
export const debugTranslations = async (req: Request, res: Response): Promise<void> => {
  try {
    const language = req.query.lang as 'en' | 'ar' || 'en';
    const testCategoryName = req.query.category as string || 'Electronics';
    
    console.log('=== Debug Translations ===');
    console.log('Language:', language);
    console.log('Test category:', testCategoryName);
    
    // Test generateKey
    const nameKey = TranslationService.generateKey(testCategoryName, 'cat', 'name');
    console.log('Generated key:', nameKey);
    
    // Test getTranslations
    const translations = await TranslationService.getTranslations(language);
    console.log('Total translations found:', Object.keys(translations).length);
    console.log('Translation for test key:', translations[nameKey]);
    
    // Test with actual categories
    const categories = await Category.find().limit(3).lean();
    console.log('Sample categories:', categories.map(c => c.name));
    
    const translatedCategories = await TranslationService.translateCategories(categories, language);
    console.log('Translated categories:', translatedCategories.map(c => ({ 
      original: c.originalName, 
      translated: c.name 
    })));
    
    res.json({
      language,
      testCategory: testCategoryName,
      generatedKey: nameKey,
      translationFound: !!translations[nameKey],
      translationValue: translations[nameKey],
      totalTranslations: Object.keys(translations).length,
      sampleCategories: categories.map(c => c.name),
      translatedSample: translatedCategories.map(c => ({ 
        original: c.originalName, 
        translated: c.name 
      }))
    });
  } catch (error) {
    console.error('Debug translations error:', error);
    res.status(500).json({ error: error.message });
  }
};
