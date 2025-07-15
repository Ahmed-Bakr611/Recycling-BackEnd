import express from "express";
import { createOrder, getAllOrders } from "../controllers/pickupController";

export default (router : express.Router) => {
  router.post("/api/orders", createOrder);
  router.get("/api/orders", getAllOrders);

  return router;
};
