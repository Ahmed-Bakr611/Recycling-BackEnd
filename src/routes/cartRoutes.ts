import express from "express";
import {
  addItemToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  saveCart,
  debugCartTranslations,
  translateCart,
} from "../controllers/cartControllers";
import { optionalAuthenticate } from "../middlewares/authenticate";

export default (router: express.Router) => {
  router.get("/cart", optionalAuthenticate, getCart);
  router.post("/cart", optionalAuthenticate, addItemToCart);
  router.put("/cart", optionalAuthenticate, updateCartItem);
  router.delete("/cart/:_id", optionalAuthenticate, removeCartItem);
  router.delete("/cart/", optionalAuthenticate, clearCart);
  router.post("/cart/save", optionalAuthenticate, saveCart);
  router.post("/cart/translate", optionalAuthenticate, translateCart);

  // Debug route for cart translations
  router.get("/cart/debug-translations", debugCartTranslations);
};
