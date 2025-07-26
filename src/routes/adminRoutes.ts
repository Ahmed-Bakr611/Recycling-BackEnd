import express from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import {
  getAllOrdersForAdmin,
  getPendingOrders,
  getAssignedOrders,
  confirmOrder,
  assignDriverToOrder,
  deleteOrder,
  getAvailableDrivers
} from "../controllers/adminController";

export default (router: express.Router) => {
  // 1. Get all orders for admin with pagination and filtering
  router.get("/admin/orders", authenticate, authorize(["admin"]), getAllOrdersForAdmin);
  
  // 2. Get pending orders for admin approval
  router.get("/admin/orders/pending", authenticate, authorize(["admin"]), getPendingOrders);
  
  // 3. Get assigned orders
  router.get("/admin/orders/assigned", authenticate, authorize(["admin"]), getAssignedOrders);
  
  // 4. Confirm order
  router.patch("/admin/orders/:id/confirm", authenticate, authorize(["admin"]), confirmOrder);
  
  // 5. Assign driver to order
  router.patch("/admin/orders/:id/assign-driver", authenticate, authorize(["admin"]), assignDriverToOrder);
  
  // 6. Delete order
  router.delete("/api/orders/:id", authenticate, authorize(["admin"]), deleteOrder);
  
  // 7. Get available drivers
  router.get("/api/users", authenticate, authorize(["admin"]), getAvailableDrivers);
  
  return router;
}; 