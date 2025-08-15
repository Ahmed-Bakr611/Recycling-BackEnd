import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import translationService from "../utils/translationInstance"; // Import the singleton
interface MulterRequest extends Request {
  file: Express.Multer.File;
}


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
      if (name && nameAr) {
        // Both languages provided
        await translationService.addCategoryTranslation(
          category.name, // Use database name as key
          { en: name, ar: nameAr },
          { en: description, ar: descriptionAr }
        );
      } else {
        // Fallback to single language
        await translationService.addCategoryTranslationSingle(
          category.name, 
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

    res.paginated(categories, total);
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

    let modifiedCategories = categories;
    if (role === "buyer") {
      modifiedCategories = categories.map(category => {
        // Convert category to a plain object to avoid DocumentArray issues
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
      data: role === "buyer" ? modifiedCategories : categories,
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
      // Add category translation
      if (name && nameAr) {
        await translationService.addCategoryTranslation(
          newCategory.name,
          { en: name, ar: nameAr },
          { en: description, ar: descriptionAr }
        );
      } else {
        await translationService.addCategoryTranslationSingle(
          newCategory.name, 
          description || descriptionAr
        );
      }

      // Add item translation
      if (itemName && itemNameAr) {
        await translationService.addItemTranslation(
          newCategory.name,
          newCategory.items[0].name,
          { en: itemName, ar: itemNameAr }
        );
      } else {
        await translationService.addItemTranslationSingle(
          newCategory.name, 
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

    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const oldName = category.name;

    // Update database
    if (name) category.name = name;
    if (description) category.description = description;
    if (imageFromFile) category.image = imageFromFile;
    else if (imageFromBody) category.image = imageFromBody;

    const updated = await category.save();

    // Update translations
    try {
      if (name && name !== oldName) {
        // Name changed - remove old and add new
        await translationService.removeCategoryTranslation(oldName);
        
        if (name && nameAr) {
          await translationService.addCategoryTranslation(
            name,
            { en: name, ar: nameAr },
            { en: description, ar: descriptionAr }
          );
        } else {
          await translationService.addCategoryTranslationSingle(name, description);
        }
      } else {
        // Just update existing translation
        if (name && nameAr) {
          await translationService.addCategoryTranslation(
            category.name,
            { en: name, ar: nameAr },
            { en: description, ar: descriptionAr }
          );
        }
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
    const deleted = await Category.findOneAndDelete({ name: categoryName });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Remove from translation files
    console.log('🔄 Removing category translation for:', categoryName);
    try {
      await translationService.removeCategoryTranslation(categoryName);
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
    const category = await Category.findOne({ name: categoryName });

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
    await translationService.addCategoryTranslation(name, description);

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

// export const addItemWithTranslation = async (
//   req: MulterRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { categoryName } = req.params;
//     const { itemName, points, price, measurement_unit, quantity } = req.body;

//     if (!req.file) {
//       res.status(400).json({ message: "Image is required" });
//       return;
//     }

//     const item = {
//       name: itemName,
//       image: req.file.path,
//       points: Number(points),
//       price: Number(price),
//       quantity: Number(quantity),
//       measurement_unit: Number(measurement_unit),
//     };

//     const updatedCategory = await Category.findOneAndUpdate(
//       { name: categoryName },
//       { $push: { items: item } },
//       { new: true }
//     );

//     if (!updatedCategory) {
//       res.status(404).json({ message: "Category not found" });
//       return;
//     }

//     // Auto-update translation files
//     await translationService.addItemTranslation(categoryName, itemName);

//     res.status(200).json(updatedCategory);
//   } catch (err) {
//     res.status(500).json({ message: (err as Error).message });
//   }
// };

export const deleteCategoryWithTranslation = async (
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

    // Remove from translation files
    await translationService.removeCategoryTranslation(categoryName);

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};