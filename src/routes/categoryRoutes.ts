import express from "express";
import multer from "multer";

import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  deleteCategory,
  updatedCategory,
  getCategoryByName,
  getCategoriesWithPagination,
  getTranslations,
  getMissingTranslations,
  createTranslation,
  getCategoryByNameForAdmin,
  seedMissingCategoryTranslations,
  debugTranslations,
  checkCurrentTranslations,
} from "../controllers/categoryController";

import {
  addItem,
  deleteItem,
  getAllItems,
  getItems,
  updateItem,
} from "../controllers/itemsController";

import {
  categoryStorage,
  subcategoryStorage,
  fileFilter,
} from "../utils/cloudinary";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { paginate } from "../middlewares/paginate";
import { handleMulterError } from "../middlewares/multerError";
import { languageMiddleware } from "../middlewares/languageMiddleware";
import { urlDecodeMiddleware } from "../middlewares/urlDecodeMiddleware";

import Category from "../models/category";
import { TranslationService } from "../services/translationService";

const uploadCategory = multer({ storage: categoryStorage, fileFilter });
const uploadSubcategory = multer({ storage: subcategoryStorage, fileFilter });

export default (router: express.Router) => {
  // Apply language middleware only on routes that return categories/items
  router.use("/categories", languageMiddleware);
  router.use("/get-items", languageMiddleware);

  // ----------------------
  // Category CRUD
  // ----------------------
  router.post(
    "/categories",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    createCategory
  );
  router.post("/translations/seed-categories", seedMissingCategoryTranslations);

  // Debug routes
  router.get("/translations/debug", debugTranslations);
  router.get("/translations/check", checkCurrentTranslations);

  router.get("/categories", paginate(), getCategoriesWithPagination);

  router.post(
    "/categories/with-image",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    createCategoryWithImage
  );

  router.put(
    "/categories/:categoryName",
    authenticate,
    authorize(["admin"]),
    urlDecodeMiddleware,
    uploadCategory.single("image"),
    handleMulterError,
    updatedCategory
  );

  router.delete(
    "/categories/:categoryName",
    authenticate,
    authorize(["admin"]),
    urlDecodeMiddleware,
    deleteCategory
  );

  // ----------------------
  // Item Routes
  // ----------------------
  router.post(
    "/categories/add-item/:categoryName",
    authenticate,
    authorize(["admin"]),
    urlDecodeMiddleware,
    uploadSubcategory.single("image"),
    handleMulterError,
    addItem
  );

  router.get(
    "/get-items/:categoryName",
    urlDecodeMiddleware,
    getCategoryByName
  );

  router.get(
    "/admin/get-items/:categoryName",
    urlDecodeMiddleware,
    getCategoryByNameForAdmin
  );

  router.get(
    "/categories/get-items/:categoryName",
    urlDecodeMiddleware,
    paginate(),
    getItems
  );

  router.get("/categories/get-items", paginate(), getAllItems);

  router.put(
    "/categories/item/:categoryName/:itemId",
    authenticate,
    authorize(["admin"]),
    urlDecodeMiddleware,
    uploadSubcategory.single("image"),
    handleMulterError,
    updateItem
  );

  router.delete(
    "/categories/item/:categoryName/:itemId",
    authenticate,
    authorize(["admin"]),
    urlDecodeMiddleware,
    deleteItem
  );

  // ----------------------
  // Translation Management (Admin only)
  // ----------------------
  router.get(
    "/categories/admin/translations",
    authenticate,
    authorize(["admin"]),
    getTranslations
  );

  router.get(
    "/categories/admin/missing-translations",
    authenticate,
    authorize(["admin"]),
    getMissingTranslations
  );

  router.post(
    "/categories/admin/translations",
    authenticate,
    authorize(["admin"]),
    createTranslation
  );

  // ----------------------
  // Bulk Item Translations
  // ----------------------
  router.post(
    "/categories/admin/bulk-create-item-translations",
    authenticate,
    authorize(["admin"]),
    async (
      req: express.Request<
        {},
        BulkCreateItemTranslationsResponse | ErrorResponse,
        BulkCreateItemTranslationsRequest
      >,
      res: express.Response<BulkCreateItemTranslationsResponse | ErrorResponse>
    ) => {
      try {
        const { categoryName }: BulkCreateItemTranslationsRequest = req.body;

        // Validation
        if (!categoryName || typeof categoryName !== "string") {
          return res.status(400).json({
            message: "Category name is required and must be a string",
          });
        }

        const trimmedCategoryName = categoryName.trim();
        if (!trimmedCategoryName) {
          return res.status(400).json({
            message: "Category name cannot be empty",
          });
        }

        // Normalize the category name for consistent lookup
        const normalizedCategoryName =
          TranslationService.normalizeText(trimmedCategoryName);

        // Find category by normalized name (assuming your database uses normalized names)
        const category = await Category.findOne({
          name: normalizedCategoryName,
        });

        if (!category) {
          return res.status(404).json({
            message: `Category not found: ${trimmedCategoryName}`,
          });
        }

        if (!Array.isArray(category.items) || category.items.length === 0) {
          return res.status(200).json({
            message: "No items found in this category",
            createdTranslations: [],
            categoryNormalizedName: normalizedCategoryName,
            totalItems: 0,
            successfulTranslations: 0,
            failedTranslations: 0,
          });
        }

        const createdTranslations: string[] = [];
        const failedItems: string[] = [];

        // Process each item
        for (const item of category.items) {
          try {
            if (!item || !item.name || typeof item.name !== "string") {
              console.warn(`Skipping invalid item:`, item);
              failedItems.push(item?.name || "unknown");
              continue;
            }

            const trimmedItemName = item.name.trim();
            if (!trimmedItemName) {
              console.warn(`Skipping empty item name:`, item);
              failedItems.push("empty_name");
              continue;
            }

            // Create translation using the updated service
            const result = await TranslationService.createItemTranslation(
              trimmedItemName, // Display name (will be normalized internally)
              normalizedCategoryName, // Already normalized category name
              trimmedItemName, // Default Arabic translation same as English for now
              item._id?.toString()
            );

            createdTranslations.push(result.itemKey);

            console.log(
              `✅ Created translation for item: ${trimmedItemName} -> ${result.normalizedSlug}`
            );
          } catch (error) {
            console.error(
              `❌ Error creating translation for item ${item.name}:`,
              error
            );
            failedItems.push(item.name);
          }
        }

        const response: BulkCreateItemTranslationsResponse = {
          message: `Created translations for ${createdTranslations.length}/${category.items.length} items`,
          createdTranslations,
          categoryNormalizedName: normalizedCategoryName,
          totalItems: category.items.length,
          successfulTranslations: createdTranslations.length,
          failedTranslations: failedItems.length,
        };

        console.log(`📊 Bulk translation summary:`, {
          category: trimmedCategoryName,
          normalizedCategory: normalizedCategoryName,
          total: category.items.length,
          successful: createdTranslations.length,
          failed: failedItems.length,
          failedItems: failedItems,
        });

        res.status(200).json(response);
      } catch (error) {
        console.error("❌ Bulk create item translations error:", error);

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        res.status(500).json({
          message: "Internal server error while creating translations",
          error: errorMessage,
        });
      }
    }
  );
};

interface BulkCreateItemTranslationsRequest {
  categoryName: string;
}

// Response interface
interface BulkCreateItemTranslationsResponse {
  message: string;
  createdTranslations: string[];
  categoryNormalizedName?: string;
  totalItems?: number;
  successfulTranslations?: number;
  failedTranslations?: number;
}

// Error response interface
interface ErrorResponse {
  message: string;
  error?: string;
}
