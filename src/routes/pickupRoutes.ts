import express from "express";
import { createOrder, getAllOrders } from "../controllers/pickupController";

export default (router : express.Router) => {
  router.post("/orders", createOrder);
  router.get("/orders", getAllOrders);

  return router;
};
