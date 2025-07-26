
import express from "express";
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getAllOrders,
  getOrderTracking,
  cancelOrderWithReason,
  emergencySubmit,
  safetyReportSubmit,
} from "../controllers/pickupController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

export default (router: express.Router) => {
  // Create order
  router.post("/api/orders", authenticate, authorize(["customer"]), createOrder);
  
  // Get orders with filters
  router.get("/api/orders", authenticate, authorize(["customer","admin"]), getAllOrders);
  router.get("/api/orders/:id", authenticate, authorize(["customer","admin"]), getOrderById);

  // Cancel order (existing endpoint)
  router.patch("/orders/:id/cancel", authenticate, authorize(["customer"]), cancelOrder);
  
  // Cancel order with reason (new endpoint)
  router.patch("/api/orders/cancel", authenticate, authorize(["customer"]), cancelOrderWithReason);

  // Order tracking
  router.get("/orders/:id/track", authenticate, authorize(["customer","admin"]), getOrderTracking);

  // Emergency and safety reports
  router.post("/orders/emergency", authenticate, authorize(["customer"]), emergencySubmit);
  router.post("/orders/safety-report", authenticate, authorize(["customer"]), safetyReportSubmit);

  return router;
};
