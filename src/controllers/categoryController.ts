import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import translationService from "../utils/translationInstance"; // Import the singleton
import { IBilingualText } from "../models/item";
import mongoose from "mongoose";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// Utility function to create bilingual text object
const createBilingualText = (en: string, ar?: string): IBilingualText => {
  return {
    en: en,
    ar: ar || en // Fallback to English if Arabic not provided
  };
};

// Utility function to get category key for translation files (using English name)
const getCategoryKey = (category: ICategory): string => {
  return category.name.en;
};

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr 
    } = req.body;

    // Validate that at least English name is provided
    if (!name) {
      res.status(400).json({ message: "English name is required" });
      return;
    }

    const image = req.file?.path ?? "";

    // Create category with bilingual names stored in database
    const category = new Category({ 
      name: createBilingualText(name, nameAr),
      description: createBilingualText(description || `${name} category`, descriptionAr),
      image, 
      items: [] 
    });
    
    await category.save();

    // Optionally still update translation files for backward compatibility
    console.log('🔄 Adding bilingual category translation to files');
    try {
      const categoryKey = getCategoryKey(category);
      
      await translationService.addCategoryTranslation(
        categoryKey,
        { en: category.name.en, ar: category.name.ar },
        { en: category.description.en, ar: category.description.ar }
      );
      
      console.log('✅ Bilingual translation added successfully');
    } catch (translationError) {
      console.error('⚠️ Translation file update failed but category was created:', translationError);
    }

    res.status(201).json(category);
  } catch (err) {
    console.error('❌ Create category error:', err);
    res.status(400).json({ message: (err as Error).message });
  }
};

export const getAllCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const language = req.query.language as 'en' | 'ar' || 'en'; // Get preferred language

    const [categories, total] = await Promise.all([
      Category.find().skip(skip).limit(limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories based on language preference
    const transformedCategories = categories.map(category => ({
      ...category,
      // Keep full bilingual data but add displayName for convenience
      displayName: category.name[language] || category.name.en,
      displayDescription: category.description[language] || category.description.en,
      items: category.items?.map((item: any) => ({
        ...item,
        displayName: item.name?.[language] || item.name?.en || item.name
      })) || []
    }));

    res.paginated(transformedCategories, total);
  } catch (err) {
    console.error('❌ Get all categories error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoriesWithPagination = async (
  req: Request,
  res: Response
) => {
  try {
    const role = req.query.role;
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    const [categories, total] = await Promise.all([
      Category.find().skip(req.pagination.skip).limit(req.pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories with language-specific display
    const transformedCategories = categories.map(category => {
      return {
        ...category,
        displayName: category.name[language] || category.name.en,
        displayDescription: category.description[language] || category.description.en,
        items: Array.isArray(category.items)
          ? category.items.map((item: any) => ({
              ...item,
              displayName: item.name?.[language] || item.name?.en || item.name,
              price: role === "buyer" && item.price 
                ? Math.round(item.price * 1.5 * 100) / 100 
                : item.price
            }))
          : [],
      };
    });

    res.json({
      success: true,
      data: transformedCategories,
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / req.pagination.limit),
        hasNextPage: req.pagination.skip + req.pagination.limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const createCategoryWithImage = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr,
      itemName, 
      itemNameAr,
      points, 
      price, 
      measurement_unit 
    } = req.body;

    if (!name || !itemName) {
      res.status(400).json({ message: "English name and item name are required" });
      return;
    }

    const newCategory = new Category({
      name: createBilingualText(name, nameAr),
      description: createBilingualText(description || `${name} category`, descriptionAr),
      image: req.file?.path ?? "",
      items: [
        {
          name: createBilingualText(itemName, itemNameAr),
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
        },
      ],
    });

    await newCategory.save();

    console.log('🔄 Adding bilingual category and item translations to files');
    try {
      const categoryKey = getCategoryKey(newCategory);
      
      // Add category translation to files
      await translationService.addCategoryTranslation(
        categoryKey,
        { en: newCategory.name.en, ar: newCategory.name.ar },
        { en: newCategory.description.en, ar: newCategory.description.ar }
      );

      // Add item translation to files
      await translationService.addItemTranslation(
        categoryKey,
        newCategory.items[0].name.en, // Use English name as key
        { en: newCategory.items[0].name.en, ar: newCategory.items[0].name.ar }
      );

      console.log('✅ Both bilingual translations added successfully');
    } catch (translationError) {
      console.error('⚠️ Translation failed but category was created:', translationError);
    }

    res.status(201).json(newCategory);
  } catch (err) {
    console.error('❌ Create category with image error:', err);
    res.status(400).json({ message: (err as Error).message });
  }
};

export const updateCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => { 
  try {
    const { categoryName } = req.params;
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr,
      image: imageFromBody 
    } = req.body;
    const imageFromFile = req.file?.path;

    // Find category by English name
    const category = await Category.findOne({ 
      "name.en": categoryName 
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const oldNameEn = category.name.en;

    // Update database fields
    if (name) category.name.en = name;
    if (nameAr) category.name.ar = nameAr;
    if (description) category.description.en = description;
    if (descriptionAr) category.description.ar = descriptionAr;
    if (imageFromFile) category.image = imageFromFile;
    else if (imageFromBody) category.image = imageFromBody;

    const updated = await category.save();
    const newNameEn = updated.name.en;

    // Handle translations in files
    try {
      // Check if the category key (English name) has changed
      const categoryKeyChanged = oldNameEn.toLowerCase() !== newNameEn?.toLowerCase();

      if (categoryKeyChanged && newNameEn) {
        // If the category key changed, rename in translation files
        console.log(`🔄 Category key changed from "${oldNameEn}" to "${newNameEn}"`);
        
        await translationService.renameCategoryKey(
          oldNameEn,
          newNameEn,
          { en: updated.name.en, ar: updated.name.ar },
          { en: updated.description.en, ar: updated.description.ar }
        );
      } else {
        // If only the display names changed, update in place
        console.log(`📝 Updating category translations for "${oldNameEn}"`);
        
        await translationService.updateCategoryTranslation(
          oldNameEn,
          { en: updated.name.en, ar: updated.name.ar },
          { en: updated.description.en, ar: updated.description.ar }
        );
      }

      console.log('✅ Translation updated successfully');
    } catch (translationError) {
      console.error('⚠️ Translation update failed:', translationError);
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('❌ Update category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    
    // Find and delete category by English name
    const deleted = await Category.findOneAndDelete({ 
      "name.en": categoryName 
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Remove from translation files
    console.log('🔄 Removing category translation for:', categoryName);
    try {
      await translationService.removeCategoryTranslation(deleted.name.en);
      console.log('✅ Translation removed successfully');
    } catch (translationError) {
      console.error('⚠️ Translation removal failed:', translationError);
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error('❌ Delete category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoryByName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    // Find category by English name
    const category = await Category.findOne({ 
      "name.en": categoryName 
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Add display fields for convenience
    const categoryWithDisplay = {
      ...category.toObject(),
      displayName: category.name[language] || category.name.en,
      displayDescription: category.description[language] || category.description.en
    };

    res.status(200).json(categoryWithDisplay);
  } catch (err) {
    console.error('❌ Get category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};
