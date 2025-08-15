import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import translationService from "../utils/translationInstance"; // Import the singleton

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// Utility function to extract category name from different formats
const extractCategoryName = (name: string | { en: string; ar?: string } | any): string => {
  if (typeof name === 'string') {
    return name;
  }
  if (typeof name === 'object' && name !== null && 'en' in name) {
    return name.en;
  }
  return 'Unknown';
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

    const image = req.file?.path ?? "";

    // Use English name as the primary key in database
    const category = new Category({ 
      name: name || nameAr, // Fallback to Arabic if English not provided
      description: description || descriptionAr, 
      image, 
      items: [] 
    });
    
    await category.save();

    // Add bilingual translations
    console.log('🔄 Adding bilingual category translation');
    try {
      const categoryName = extractCategoryName(category.name);
      
      if (!categoryName) {
        console.error('⚠️ Could not extract category name, skipping translation');
        res.status(201).json(category);
        return;
      }

      if (name && nameAr) {
        // Both languages provided
        await translationService.addCategoryTranslation(
          categoryName, // Use extracted name as key
          { en: name, ar: nameAr },
          { en: description, ar: descriptionAr }
        );
      } else {
        // Fallback to single language
        await translationService.addCategoryTranslationSingle(
          categoryName, 
          description || descriptionAr
        );
      }
      console.log('✅ Bilingual translation added successfully');
    } catch (translationError) {
      console.error('⚠️ Translation failed but category was created:', translationError);
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
    const [categories, total] = await Promise.all([
      Category.find().skip(skip).limit(limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories to use simple string names
    const transformedCategories = categories.map(category => ({
      ...category,
      name: extractCategoryName(category.name),
      items: category.items?.map((item: any) => ({
        ...item,
        name: extractCategoryName(item.name)
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
    const [categories, total] = await Promise.all([
      Category.find().skip(req.pagination.skip).limit(req.pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories to use simple string names
    const transformedCategories = categories.map(category => {
      const plainCategory = typeof category.toObject === "function" ? category.toObject() : category;
      return {
        ...plainCategory,
        name: extractCategoryName(plainCategory.name),
        items: Array.isArray(plainCategory.items)
          ? plainCategory.items.map((item: any) => ({
              ...item,
              name: extractCategoryName(item.name),
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

    const newCategory = new Category({
      name: name || nameAr,
      description: description || descriptionAr,
      image: req.file?.path ?? "",
      items: [
        {
          name: itemName || itemNameAr,
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
        },
      ],
    });

    await newCategory.save();

    console.log('🔄 Adding bilingual category and item translations');
    try {
      const categoryName = extractCategoryName(newCategory.name);
      
      if (!categoryName) {
        console.error('⚠️ Could not extract category name, skipping translations');
        res.status(201).json(newCategory);
        return;
      }

      // Add category translation
      if (name && nameAr) {
        await translationService.addCategoryTranslation(
          categoryName,
          { en: name, ar: nameAr },
          { en: description, ar: descriptionAr }
        );
      } else {
        await translationService.addCategoryTranslationSingle(
          categoryName, 
          description || descriptionAr
        );
      }

      // Add item translation
      if (itemName && itemNameAr) {
        await translationService.addItemTranslation(
          categoryName,
          newCategory.items[0].name,
          { en: itemName, ar: itemNameAr }
        );
      } else {
        await translationService.addItemTranslationSingle(
          categoryName, 
          newCategory.items[0].name
        );
      }

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

export const updatedCategory = async (
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

    // Find category
    const category = await Category.findOne({ 
      $or: [
        { name: categoryName },
        { "name.en": categoryName }
      ]
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const oldName = extractCategoryName(category.name);

    // Update database fields
    if (name) {
      if (typeof category.name === 'object') {
        category.name.en = name;
      } else {
        category.name = name;
      }
    }
    
    if (nameAr && typeof category.name === 'object') {
      category.name.ar = nameAr;
    }
    
    if (description) category.description = description;
    if (imageFromFile) category.image = imageFromFile;
    else if (imageFromBody) category.image = imageFromBody;

    const updated = await category.save();
    const newName = extractCategoryName(updated.name);

    // Handle translations
    try {
      if (!oldName) {
        console.error('⚠️ Could not extract old category name');
        res.status(200).json(updated);
        return;
      }

      // Check if the category key (name) has changed
      const categoryKeyChanged = oldName.toLowerCase() !== newName?.toLowerCase();

      if (categoryKeyChanged && newName) {
        // If the category key changed, we need to rename the category key
        console.log(`🔄 Category key changed from "${oldName}" to "${newName}"`);
        
        const updatedNames = {
          en: name || newName,
          ar: nameAr || newName
        };

        const updatedDescriptions = {
          en: description || category.description,
          ar: descriptionAr || category.description
        };

        // Use renameCategoryKey to move from old key to new key
        await translationService.renameCategoryKey(
          oldName,
          newName,
          updatedNames,
          updatedDescriptions
        );
      } else {
        // If only the display names changed (not the key), update in place
        console.log(`📝 Updating category translations for "${oldName}"`);
        
        // Get current translations to preserve existing values
        const currentTranslations = await translationService.getCategoryTranslation(oldName) || {
          name: { en: '', ar: '' },
          description: { en: '', ar: '' }
        };

        const updatedNames = {
          en: name || currentTranslations.name.en || oldName,
          ar: nameAr || currentTranslations.name.ar || currentTranslations.name.en || oldName
        };

        const updatedDescriptions = {
          en: description || currentTranslations.description.en || category.description,
          ar: descriptionAr || currentTranslations.description.ar || category.description
        };

        // Use updateCategoryTranslation to update existing category
        await translationService.updateCategoryTranslation(
          oldName, // Keep the same key
          updatedNames,
          updatedDescriptions
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
    
    // Find and delete category with both string and object name formats
    const deleted = await Category.findOneAndDelete({ 
      $or: [
        { name: categoryName }, // For string names
        { "name.en": categoryName } // For object names with English key
      ]
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Remove from translation files
    console.log('🔄 Removing category translation for:', categoryName);
    try {
      const extractedName = extractCategoryName(deleted.name);
      
      if (extractedName) {
        await translationService.removeCategoryTranslation(extractedName);
        console.log('✅ Translation removed successfully');
      } else {
        console.error('⚠️ Could not extract category name, skipping translation removal');
      }
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
    
    // Find category with both string and object name formats
    const category = await Category.findOne({ 
      $or: [
        { name: categoryName }, // For string names
        { "name.en": categoryName } // For object names with English key
      ]
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json(category);
  } catch (err) {
    console.error('❌ Get category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createCategoryWithTranslation = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description } = req.body;
    const image = req.file?.path ?? "";

    const category = new Category({ name, description, image, items: [] });
    await category.save();

    // Auto-update translation files
    const categoryName = extractCategoryName(category.name);
    
    if (categoryName) {
      await translationService.addCategoryTranslation(categoryName, description);
      console.log('✅ Translation added successfully');
    } else {
      console.error('⚠️ Could not extract category name, skipping translation');
    }

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const deleteCategoryWithTranslation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    
    // Find and delete category with both string and object name formats
    const deleted = await Category.findOneAndDelete({ 
      $or: [
        { name: categoryName }, // For string names
        { "name.en": categoryName } // For object names with English key
      ]
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Remove from translation files
    const extractedName = extractCategoryName(deleted.name);
    
    if (extractedName) {
      await translationService.removeCategoryTranslation(extractedName);
      console.log('✅ Translation removed successfully');
    } else {
      console.error('⚠️ Could not extract category name, skipping translation removal');
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};