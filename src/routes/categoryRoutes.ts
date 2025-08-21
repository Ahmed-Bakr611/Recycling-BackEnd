import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  deleteCategory,
  updateCategory,
  getCategoryByName,
  getCategoriesWithPagination,
} from "../controllers/categoryController";
import {
  addItem,
  deleteItem,
  getAllItems,
  getItems,
  migrateToBilingual,
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
import { getItemsIndex, searchItems } from "../controllers/searchController";

const uploadCategory = multer({ storage: categoryStorage, fileFilter });
const uploadSubcategory = multer({ storage: subcategoryStorage, fileFilter });

export default (router: express.Router) => {
  router.post(
    "/categories",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    createCategory
  );
  router.post("/migrate", migrateToBilingual);
  router.get("/categories", paginate(), getCategoriesWithPagination);
  router.post(
    "/categories/with-image",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
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
};
