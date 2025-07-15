import express from "express";
import { createOrder } from "../controllers/pickupController";

export default (router : express.Router) => {
  router.post("/api/orders", createOrder);
  return router;
};
