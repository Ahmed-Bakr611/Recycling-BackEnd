import multer from "multer";

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size allowed is 5MB.",
          error: "FILE_TOO_LARGE"
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected field name. Please check your form field.",
          error: "UNEXPECTED_FIELD"
        });
      default:
        return res.status(400).json({
          success: false,
          message: "File upload error occurred.",
          error: err.code
        });
    }
  }

  // Handle custom fileFilter errors
  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: "INVALID_FILE_TYPE"
    });
  }

  // Handle other errors
  if (err.message && err.message.includes("files are allowed")) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: "INVALID_FILE_TYPE"
    });
  }

  next(err);
};

import express from "express";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  deleteCategory,
  updateCategory,
  getCategoryByName,
  getCategoriesWithPagination,
  getItemsWithSearch,
  getCategoryNames,
  getSearchSuggestions,
  getCategoriesWithSearch,
} from "../controllers/categoryController";
import {
  addItem,
  deleteItem,
  getAllItems,
  getItemByName,
  getItems,
  getItemsByIds,
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
import { getItemsIndex, searchItems } from "../controllers/searchController";

const uploadCategory = multer({ storage: categoryStorage, fileFilter });
const uploadSubcategory = multer({ storage: subcategoryStorage, fileFilter });

export default (router: express.Router) => {
  router.post(
    "/categories",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    handleMulterError,
    createCategory
  );
  
  
  router.get("/categories", paginate(), getCategoriesWithPagination);
  
  router.post(
    "/categories/with-image",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    handleMulterError,
    createCategoryWithImage
  );
  
  router.post(
    "/categories/add-item/:categoryName",
    authenticate,
    authorize(["admin"]),
    uploadSubcategory.single("image"),
    handleMulterError,
    addItem
  );
  
  router.get("/get-items/:categoryName", getCategoryByName);
  
  router.get("/categories/get-items/:categoryName", paginate(), getItems);
  
  router.get("/categories/get-items", paginate(), getAllItems);
  
  router.put(
    "/categories/:categoryName",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    handleMulterError,
    updateCategory
  );
  router.post('/items/get-by-id', getItemsByIds);
  router.delete(
    "/categories/:categoryName",
    authenticate,
    authorize(["admin"]),
    deleteCategory
  );
  
  router.put(
    "/categories/item/:categoryName/:itemId",
    authenticate,
    authorize(["admin"]),
    uploadSubcategory.single("image"),
    handleMulterError,
    updateItem
  );
  
  router.delete(
    "/categories/item/:categoryName/:itemId",
    authenticate,
    authorize(["admin"]),
    deleteItem
  );

  //search
  router.get("/search-index", getItemsIndex);
  router.get("/search", searchItems);
  router.get('/get-items', paginate(), getItemsWithSearch);

// Get category names for dropdown filter
router.get('/category-names', getCategoryNames);
router.get('/items/by-name/:itemName', getItemByName);
router.get('/categories/search', getCategoriesWithSearch);
router.get('/categories/search-suggestions', getSearchSuggestions);

// Optional: Search suggestions for autocomplete
};
