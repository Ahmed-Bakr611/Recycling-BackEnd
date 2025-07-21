import express from "express";
import multer from "multer";
import {
  createCategory,
  getAllCategories,
  createCategoryWithImage,
  addItem,
  getItems,
  deleteCategory,
  updateItem,
  updatedCategory,
  deleteItem,
  getAllItems,
  getCategoryByName,
  getAllCategoryNames,
} from "../controllers/categoryController";
import { categoryStorage, subcategoryStorage } from "../utils/cloudinary";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

const router = express.Router();
const uploadCategory = multer({ storage: categoryStorage });
const uploadSubcategory = multer({ storage: subcategoryStorage });

router.post("/", authenticate,authorize(["admin"]),uploadCategory.single("image"), createCategory);
router.get("/category-names", getAllCategoryNames);
router.get("/", getAllCategories);
router.get("/:categoryName", getCategoryByName);
router.post("/with-image",authenticate,authorize(["admin"]),uploadCategory.single("image"),createCategoryWithImage);
router.post("/add-item/:categoryName",authenticate,authorize(["admin"]),uploadSubcategory.single("image"),addItem);
router.get("/get-items/:categoryName", getItems);
router.get("/get-items", getAllItems);
router.put("/:categoryName",authenticate,authorize(["admin"]), uploadCategory.single("image"), updatedCategory);
router.delete("/:categoryName",authenticate,authorize(["admin"]), deleteCategory);
router.put("/item/:categoryName/:itemId",authenticate,authorize(["admin"]),uploadSubcategory.single("image"),updateItem);
router.delete("/item/:categoryName/:itemId", deleteItem);

export default router;
