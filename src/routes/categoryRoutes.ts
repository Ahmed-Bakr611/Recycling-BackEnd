import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  deleteCategory,
  updatedCategory,
} from "../controllers/categoryController";
import {
  addItem,
  deleteItem,
  getAllItems,
  getItems,
  updateItem,
} from "../controllers/itemsController";
import { categoryStorage, subcategoryStorage } from "../utils/cloudinary";

const uploadCategory = multer({ storage: categoryStorage });
const uploadSubcategory = multer({ storage: subcategoryStorage });

export default (router: express.Router) => {
  router.post("categories/", uploadCategory.single("image"), createCategory);
  router.get("categories/", getAllCategories);
  router.post(
    "categories/with-image",
    uploadCategory.single("image"),
    createCategoryWithImage
  );
  router.post(
    "categories/add-item/:categoryName",
    uploadSubcategory.single("image"),
    addItem
  );
  router.get("categories/get-items/:categoryName", getItems);
  router.get("categories/get-items", getAllItems);
  router.put(
    "categories/:categoryName",
    uploadCategory.single("image"),
    updatedCategory
  );
  router.delete("categories/:categoryName", deleteCategory);
  router.put(
    "categories/item/:categoryName/:itemId",
    uploadSubcategory.single("image"),
    updateItem
  );
  router.delete("categories/item/:categoryName/:itemId", deleteItem);
};
