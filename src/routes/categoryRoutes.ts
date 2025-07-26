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
} from "../controllers/categoryController";
import {
  addItem,
  deleteItem,
  getAllItems,
  getItems,
  updateItem,
} from "../controllers/itemsController";
import { categoryStorage, subcategoryStorage } from "../utils/cloudinary";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { paginate } from "../middlewares/paginate";

const uploadCategory = multer({ storage: categoryStorage });
const uploadSubcategory = multer({ storage: subcategoryStorage });

export default (router: express.Router) => {
  router.post(
    "/categories",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    createCategory
  );
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
    updatedCategory
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
    updateItem
  );
  router.delete(
    "/categories/item/:categoryName/:itemId",
    authenticate,
    authorize(["admin"]),
    deleteItem
  );
};
