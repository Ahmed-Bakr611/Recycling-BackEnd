import express from "express";
import { 
  createOrder, 
  deleteAllOrders, 
  deleteOrderById, 
  getAllOrders,
  getOrderById,
  getOrdersByStatus,
  updateOrderStatus
} from "../controllers/pickupController";
import { authenticate } from "../middlewares/auth"; // Import your existing middleware

export default (router: express.Router) => {
  // All routes now require authentication using your existing middleware
  router.post("/orders", authenticate, createOrder);
  router.get("/orders", authenticate, getAllOrders);
  router.get("/orders/:id", authenticate, getOrderById);
  router.get("/orders/status/:status", authenticate, getOrdersByStatus);
  router.put("/orders/:id/status", authenticate, updateOrderStatus);
  router.delete("/orders/:id", authenticate, deleteOrderById);
  router.delete("/orders", authenticate, deleteAllOrders);

  return router;
};