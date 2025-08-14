import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import { TranslationService } from "../services/translationService";
import Translation from "../models/translation";  // Make sure this line exists

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface TranslatedRequest extends Request {
  language?: 'en' | 'ar';
}

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, nameAr, descriptionAr } = req.body;
    const image = req.file?.path ?? "";

    // Create category with slug
    const category = new Category({ 
      name, 
      description, 
      image, 
      items: [],
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
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
  req: any, // Use any to avoid TypeScript issues for now
  res: Response
) => {
  try {
    const role = req.query.role;
    const language = (req.query.lang as 'en' | 'ar') || req.language || 'en';
    const pagination = req.pagination || { skip: 0, limit: 10, page: 1 };
    
    console.log('=== getCategoriesWithPagination Debug ===');
    console.log('Language requested:', language);
    console.log('Req.language from middleware:', req.language);

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
        // Fall back to original categories if translation fails
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

    // Create category (your existing logic)
    const newCategory = new Category({
      name,
      description,
      image: req.file?.path ?? "",
      items: [
        {
          name: itemName,
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
          categoryName: name
        },
      ],
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

    // Find by slug or name
    const category = await Category.findOne({
      $or: [
        { slug: categoryName },
        { name: { $regex: new RegExp(`^${categoryName}$`, 'i') } }
      ]
    });

    if (!category) {
      return res.status(404).json({ 
        message: "Category not found",
        searchedName: categoryName,
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
      const newName = name.toLowerCase();
      if (newName !== category.name) {
        category.name = newName;
        category.slug = newName.replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        
        // Update category name in all items
        category.items.forEach((item) => {
          item.categoryName = newName;
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

    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory
    });
  } catch (err) {
    console.error("Update category error:", err);
    res.status(500).json({ 
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
    const deleted = await Category.findOneAndDelete({ name: categoryName });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Clean up related translations
    const nameKey = TranslationService.generateKey(categoryName, 'cat', 'name');
    const descKey = TranslationService.generateKey(categoryName, 'cat', 'desc');
    
    // Create array of item translation keys
    const itemTranslationPromises = deleted.items.map(item => {
      const itemKey = TranslationService.generateKey(`${categoryName}_${item.name}`, 'item');
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

    // Search by either slug or name
    const category = await Category.findOne({
      $or: [
        { slug: categoryName },
        { name: categoryName }
      ]
    }).lean();

    if (!category) {
      res.status(404).json({ message: "Category not found" });
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
