import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  addItem,
  getItems,
} from "../controllers/categoryController";
import { categoryStorage, subcategoryStorage } from "../utils/cloudinary";

const router = express.Router();

const uploadCategory = multer({ storage: categoryStorage });
const uploadSubcategory = multer({ storage: subcategoryStorage });

router.post("/", uploadCategory.single("image"), createCategory);
router.get("/", getAllCategories);
router.post("/with-image", uploadCategory.single("image"), createCategoryWithImage);
router.post("/add-item/:categoryName", uploadSubcategory.single("image"), addItem);
router.get("/get-items/:categoryName", getItems);

export default router;
