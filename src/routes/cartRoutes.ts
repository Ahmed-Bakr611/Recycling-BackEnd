import express from "express";
import {
  addItemToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartControllers";

export default (router: express.Router) => {
  router.get("/cart", getCart);
  router.post("/cart", addItemToCart);
  router.put("/cart", updateCartItem);
  router.delete("/cart/:categoryId", removeCartItem);
  router.delete("cart/", clearCart);
};
