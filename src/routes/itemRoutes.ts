import express from "express";
import multer from "multer";
import {
  getAllItems,
  getItemsByCategory,
  createItem,
  updateItem,
  deleteItem,
  getItemsByName,
} from "../controllers/itemsController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize"; // optional if admin-restricted
import { subcategoryStorage } from "../utils/cloudinary";

const upload = multer({ storage: subcategoryStorage });

export default (router: express.Router) => {
  router.get("/items", getAllItems);
  router.get("/items/category/:categoryId", getItemsByCategory);
  router.get("/items/search/:itemName", getItemsByName);

  router.post(
    "/items/:categoryId",
    upload.single("image"),
    authenticate,
    authorize(["admin"]),
    createItem
  );

  router.put(
    "/items/:itemId",
    upload.single("image"),
    authenticate,
    authorize(["admin"]),
    updateItem
  );

  router.delete(
    "/items/:itemId",
    authenticate,
    authorize(["admin"]),
    deleteItem
  );
};
