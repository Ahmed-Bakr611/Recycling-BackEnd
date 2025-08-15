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
    async (req: express.Request, res: express.Response) => {
      try {
        const { categoryName } = req.body;
        if (!categoryName)
          return res.status(400).json({ message: "Category name is required" });

  const category = await Category.findOne({ name: categoryName });
        if (!category)
          return res.status(404).json({ message: "Category not found" });

        const createdTranslations: string[] = [];

        for (const item of category.items) {
          try {
            const safeItemName = typeof item.name === 'string' ? item.name : (item.name?.en || Object.values(item.name || {})[0] || '');
            const safeCategoryName = typeof categoryName === 'string' ? categoryName : (categoryName?.toString() || '');
            const itemKey = await TranslationService.createItemTranslation(
              safeItemName.trim(),
              safeCategoryName.trim(),
              safeItemName.trim(), // Default Arabic translation same as English
              item._id?.toString()
            );
            createdTranslations.push(itemKey);
          } catch (error) {
            console.error(
              `Error creating translation for item ${typeof item.name === 'string' ? item.name : JSON.stringify(item.name)}:`,
              error
            );
          }
        }

        res.status(200).json({
          message: `Created translations for ${createdTranslations.length} items`,
          createdTranslations,
        });
      } catch (error) {
        console.error("Bulk create item translations error:", error);
        res.status(500).json({ message: (error as Error).message });
      }
    }
  );
};
