import multer  from 'multer';
import express from "express";

import { storage } from "../utils/cloudinary";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  addSubcategory,
  getSubcategories
} from "../controllers/categoryController";

const router = express.Router();
const upload = multer({ storage });

router.post("/", createCategory);
router.get("/", getAllCategories);
router.post("/with-image", upload.single("image"), createCategoryWithImage);
router.post("/subcategory/:categoryName", upload.single("image"), addSubcategory);
router.get("/:categoryName/subcategories", getSubcategories);

export default router;
