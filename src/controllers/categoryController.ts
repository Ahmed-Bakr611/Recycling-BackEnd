import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import { TranslationService } from "../services/translationService";
import Translation from "../models/translation";
import translation from "../models/translation";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface TranslatedRequest extends Request {
  language?: "en" | "ar";
}

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, nameAr, descriptionAr } = req.body;
    const image = req.file?.path ?? "";

    // ✅ FIXED - Use TranslationService to get normalized values
    const translationResult =
      await TranslationService.createCategoryTranslations(
        name,
        description,
        nameAr,
        descriptionAr
      );

    // ✅ FIXED - Create category with normalized name and slug
    const category = new Category({
      name: translationResult.normalizedSlug, // ✅ Use normalized name
      slug: translationResult.normalizedSlug, // ✅ Same as name
      description,
      image,
      items: [],
    });

    await category.save();

    // Update translation with category ID
    await TranslationService.createCategoryTranslations(
      name,
      description,
      nameAr,
      descriptionAr,
      category._id.toString()
    );

    res.status(201).json(category);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(400).json({ message: (err as Error).message });
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
      itemName,
      points,
      price,
      measurement_unit,
      nameAr,
      descriptionAr,
      itemNameAr,
    } = req.body;

    // ✅ FIXED - Get normalized category values
    const categoryTranslation =
      await TranslationService.createCategoryTranslations(
        name,
        description,
        nameAr,
        descriptionAr
      );

    // ✅ FIXED - Get normalized item values
    const itemTranslation = await TranslationService.createItemTranslation(
      itemName,
      categoryTranslation.normalizedSlug, // ✅ Use normalized category name
      itemNameAr
    );

    // ✅ FIXED - Create category with normalized values
    const newCategory = new Category({
      name: categoryTranslation.normalizedSlug, // ✅ Normalized
      slug: categoryTranslation.normalizedSlug, // ✅ Same as name
      description,
      image: req.file?.path ?? "",
      items: [
        {
          name: itemTranslation.normalizedSlug, // ✅ Normalized item name
          slug: itemTranslation.normalizedSlug, // ✅ Same as name
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
          categoryName: categoryTranslation.normalizedSlug, // ✅ Normalized category name
        },
      ],
    });

    await newCategory.save();

    // Update translations with actual IDs
    await TranslationService.createCategoryTranslations(
      name,
      description,
      nameAr,
      descriptionAr,
      newCategory._id.toString()
    );

    const itemId = newCategory.items[0]._id?.toString();
    await TranslationService.createItemTranslation(
      itemName,
      categoryTranslation.normalizedSlug,
      itemNameAr,
      itemId
    );

    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const getAllCategories = async (
  req: TranslatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const language = req.language || (req.query.lang as "en" | "ar") || "en";

    const [categories, total] = await Promise.all([
      Category.find().skip(skip).limit(limit).lean(),
      Category.countDocuments(),
    ]);

    // ✅ FIXED - Always translate (service handles language logic)
    const finalCategories = await TranslationService.translateCategories(
      categories,
      language
    );

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
    const language = (req.query.lang as "en" | "ar") || req.language || "en";
    const pagination = req.pagination || { skip: 0, limit: 10, page: 1 };

    console.log("=== getCategoriesWithPagination Debug ===");
    console.log("Language requested:", language);

    const [categories, total] = await Promise.all([
      Category.find().skip(pagination.skip).limit(pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    console.log("Found categories count:", categories.length);
    console.log(
      "Sample category names:",
      categories.map((c) => c.name)
    );

    // ✅ FIXED - Always translate, service handles the logic
    let processedCategories = await TranslationService.translateCategories(
      categories,
      language
    );
    console.log("🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢");
    console.log(processedCategories);
    console.log("🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢🤢");

    // Role-based pricing logic
    if (role === "buyer") {
      processedCategories = processedCategories.map((category) => {
        const plainCategory =
          typeof category.toObject === "function"
            ? category.toObject()
            : category;
        return {
          ...plainCategory,
          items: Array.isArray(plainCategory.items)
            ? plainCategory.items.map((item: any) => ({
                ...item,
                price: item.price
                  ? Math.round(item.price * 1.5 * 100) / 100
                  : item.price,
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
    console.error("Error in getCategoriesWithPagination:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updatedCategory = async (
  req: MulterRequest,
  res: Response
): Promise<Response> => {
  try {
    const { categoryName } = req.params;
    const {
      name,
      description,
      image: imageFromBody,
      nameAr,
      descriptionAr,
    } = req.body;
    const imageFromFile = req.file?.path;

    // ✅ FIXED - Find by normalized name (categories should have normalized names in DB)
    const normalizedSearchName = categoryName;

    const category = await Category.findOne({
      $or: [
        { name: normalizedSearchName }, // Direct match with normalized name
        { slug: normalizedSearchName }, // Slug should be same as name
      ],
    });

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        searchedName: categoryName,
        normalizedSearch: normalizedSearchName,
      });
    }
    Promise.all([
      TranslationService.createOrUpdateTranslation(
        `cat_${category.slug}_name`,
        {
          en: name,
          ar: nameAr,
        },
        "category"
      ),
      TranslationService.createOrUpdateTranslation(
        `cat_${category.slug}_desc`,
        {
          en: description,
          ar: descriptionAr,
        },
        "category"
      ),
    ]);

    // Handle updates
    if (name) {
      // ✅ FIXED - Get normalized values for new name
      await TranslationService.createOrUpdateTranslation(
        `cat_${category.slug}_name`,
        { en: name, ar: nameAr },
        "category",
        category.id
      );
      category.name = TranslationService.normalizeText(name);
      category.slug = TranslationService.normalizeText(name);
      await TranslationService.updateCategoryKeys(category.id, category.slug);
    }

    if (description) category.description = description;

    // Handle image update
    if (imageFromFile) {
      category.image = imageFromFile;
    } else if (imageFromBody !== undefined) {
      category.image = imageFromBody;
    }

    const updatedCategory = await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (err) {
    console.error("Update category error:", err);
    return res.status(500).json({
      message: "Failed to update category",
      error: (err as Error).message,
    });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const normalizedName = categoryName;

    const deleted = await Category.findOneAndDelete({
      $or: [{ name: normalizedName }, { slug: normalizedName }],
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // ✅ FIXED - Clean up translations using correct keys
    const nameKey = `cat_${normalizedName}_name`;
    const descKey = `cat_${normalizedName}_desc`;

    // Create array of item translation keys
    const itemTranslationPromises = deleted.items.map((item) => {
      const itemKey = `item_${normalizedName}_${item.name}`;
      return Translation.deleteOne({ key: itemKey });
    });

    await Promise.all([
      Translation.deleteOne({ key: nameKey }),
      Translation.deleteOne({ key: descKey }),
      ...itemTranslationPromises,
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
    const language = (req.query.lang as "en" | "ar") || "en";
    const normalizedName = categoryName;

    // ✅ FIXED - Search by normalized name
    const category = await Category.findOne({
      $or: [{ name: normalizedName }, { slug: normalizedName }],
    }).lean();

    if (!category) {
      res.status(404).json({
        message: "Category not found",
        searchedFor: categoryName,
        normalizedSearch: normalizedName,
      });
      return;
    }

    // ✅ FIXED - Always translate
    const finalCategory = (
      await TranslationService.translateCategories([category], language)
    )[0];

    res.status(200).json(finalCategory);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

// ✅ FIXED - Migration function to use TranslationService
export const migrateExistingSlugs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Starting normalization migration...");

    // ✅ Use the TranslationService normalization method
    await TranslationService.normalizeExistingData();

    res.json({
      success: true,
      message:
        "Migration completed - all data normalized using TranslationService",
    });
  } catch (error) {
    console.error("Migration failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const seedMissingCategoryTranslations = async (
  req: Request,
  res: Response
) => {
  try {
    const categories = await Category.find().lean();
    const createdKeys: string[] = [];
    const skippedKeys: string[] = [];

    for (const category of categories) {
      if (!category.name) continue;

      // ✅ FIXED - Use correct key format
      const nameKey = `cat_${category.name}_name`;
      const descKey = `cat_${category.name}_desc`;

      // Check if name translation exists
      const existingName = await Translation.findOne({ key: nameKey });
      if (!existingName) {
        await TranslationService.createOrUpdateTranslation(
          nameKey,
          { en: category.name, ar: category.name }, // Will be normalized by service
          "category",
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
          { en: category.description || "", ar: category.description || "" },
          "category",
          category._id.toString()
        );
        createdKeys.push(descKey);
      } else {
        skippedKeys.push(descKey);
      }
    }

    return res.json({
      success: true,
      message: "Category translations seeding complete.",
      createdKeys,
      skippedKeys,
    });
  } catch (err) {
    console.error("Error seeding category translations:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

export const getCategoryByNameForAdmin = async (
  req: Request,
  res: Response
) => {
  try {
    const rawName = req.params.categoryName;
    const normalizedName = TranslationService.normalizeText(
      decodeURIComponent(rawName)
    );

    console.log("Searching for category name:", normalizedName);

    // ✅ FIXED - Search translations using normalized text matching
    const translationDoc = await TranslationService.getTheRightTrnslation(
      rawName,
      "category"
    );

    if (!translationDoc) {
      return res.status(404).json({
        message: "Category translation not found",
        searchedFor: rawName,
        normalizedSearch: normalizedName,
      });
    }

    // Find the actual category using the reference ID
    const category = await Category.findById(translationDoc.referenceId);

    if (!category) {
      return res.status(404).json({
        message: "Category not found for matching translation",
        translationMatch: translationDoc,
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("getCategoryByNameForAdmin error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// Keep existing translation management endpoints...
export const getTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = (req.query.lang as "en" | "ar") || "en";
    const translations = await TranslationService.getTranslations(language);

    res.json({
      success: true,
      data: translations,
      language,
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
      data: missing,
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
      data: translation,
    });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const checkCurrentTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const allTranslations = await Translation.find().lean();

    res.json({
      total: allTranslations.length,
      translations: allTranslations.map((t) => ({
        key: t.key,
        en: t.translations.en,
        ar: t.translations.ar,
        type: t.type,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const debugTranslations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = (req.query.lang as "en" | "ar") || "en";
    const testCategoryName = (req.query.category as string) || "Electronics";

    console.log("=== Debug Translations ===");
    console.log("Language:", language);
    console.log("Test category:", testCategoryName);

    // ✅ FIXED - Use correct key format
    const normalizedName = TranslationService.normalizeText(testCategoryName);
    const nameKey = `cat_${normalizedName}_name`;
    console.log("Generated key:", nameKey);

    const translations = await TranslationService.getTranslations(language);
    console.log("Total translations found:", Object.keys(translations).length);
    console.log("Translation for test key:", translations[nameKey]);

    const categories = await Category.find().limit(3).lean();
    console.log(
      "Sample categories:",
      categories.map((c) => c.name)
    );

    const translatedCategories = await TranslationService.translateCategories(
      categories,
      language
    );
    console.log(
      "Translated categories:",
      translatedCategories.map((c) => ({
        name: c.name,
        displayName: c.displayName,
      }))
    );

    res.json({
      language,
      testCategory: testCategoryName,
      normalizedName,
      generatedKey: nameKey,
      translationFound: !!translations[nameKey],
      translationValue: translations[nameKey],
      totalTranslations: Object.keys(translations).length,
      sampleCategories: categories.map((c) => c.name),
      translatedSample: translatedCategories.map((c) => ({
        name: c.name,
        displayName: c.displayName,
      })),
    });
  } catch (error) {
    console.error("Debug translations error:", error);
    res.status(500).json({ error: error.message });
  }
};
