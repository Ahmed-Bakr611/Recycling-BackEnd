
import express from "express";
import {
  cancelOrder,
  createOrder,
  deleteAllOrders,
  deleteOrderById,
  getAllOrders,
  getAllOrdersForAdmin,
  getOrderById,
  getOrdersByStatus,
  updateOrderStatus,
  updateOrderStatusByAdmin,
} from "../controllers/pickupController";
import { authorize } from "../middlewares/authorize";
import { authenticate } from "../middlewares/authenticate";

export default (router: express.Router) => {
  // All routes now require authentication using your existing middleware
router.get("/orders", authenticate, authorize(["customer", "admin"]), getAllOrders);
router.post("/orders", authenticate,  createOrder);
router.get("/orders/:id", authenticate, authorize(["customer", "admin"]), getOrderById);
router.delete("/orders/:id", authenticate, authorize(["customer", "admin"]), deleteOrderById);
router.delete("/orders", authenticate, authorize(["customer", "admin"]), deleteAllOrders);
router.get("/orders/status/:status", authenticate, authorize(["customer", "admin"]), getOrdersByStatus);
router.put("/orders/:id/status", authenticate, authorize(["customer", "admin"]), updateOrderStatus);

// 🛡️ ADMIN routes
router.get("/admin/orders", authenticate, authorize(["admin"]), getAllOrdersForAdmin);
router.put("/admin/orders/:id/status", authenticate, authorize(["admin"]), updateOrderStatusByAdmin);

router.patch(
  "/orders/:id/cancel",
  authenticate,
  authorize(["customer", "admin"]),
  cancelOrder
)
  return router;
};
