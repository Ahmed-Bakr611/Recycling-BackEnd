import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  addSubcategory,
  getSubcategories,
} from "../controllers/categoryController";
import { categoryStorage, subcategoryStorage } from "../utils/cloudinary";

const router = express.Router();

const uploadCategory = multer({ storage: categoryStorage });
const uploadSubcategory = multer({ storage: subcategoryStorage });

router.post("/", uploadCategory.single("image"), createCategory);
router.get("/", getAllCategories);
router.post("/with-image", uploadCategory.single("image"), createCategoryWithImage);
router.post("/subcategory/:categoryName", uploadSubcategory.single("image"), addSubcategory);
router.get("/:categoryName/subcategories", getSubcategories);

export default router;
