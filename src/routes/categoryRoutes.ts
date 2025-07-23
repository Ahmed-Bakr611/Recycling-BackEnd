import { authenticate } from "./../middlewares/authenticate";
import { authorize } from "./../middlewares/authorize";

import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";
import { categoryStorage } from "../utils/cloudinary";
const uploadCategory = multer({ storage: categoryStorage });

export default (router: express.Router) => {
  router.get("/categories", getAllCategories);

  router.post(
    "/categories",
    authenticate,
    authorize(["admin"]),
    uploadCategory.single("image"),
    createCategory
  );

  router.put(
    "/categories/:categoryId",
    uploadCategory.single("image"),
    authenticate,
    authorize(["admin"]),
    updateCategory
  );

  router.delete(
    "/categories/:categoryId",
    authenticate,
    authorize(["admin"]),
    deleteCategory
  );
};
