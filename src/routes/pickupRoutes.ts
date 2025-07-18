// routes/orderRoute.ts

// export default (router: Router) => {
//   router.post(
//     "/orders",
//     authenticate,
//     authorize(["customer", "admin"]),
//     createOrder
//   );
//   router.get("/orders", authenticate, authorize(["admin"]), getAllOrders);
// };
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
router.get("/orders/:id", authenticate, authorize(["user", "admin"]), getOrderById);
router.delete("/orders/:id", authenticate, authorize(["user", "admin"]), deleteOrderById);
router.delete("/orders", authenticate, authorize(["user", "admin"]), deleteAllOrders);
router.get("/orders/status/:status", authenticate, authorize(["user", "admin"]), getOrdersByStatus);
router.put("/orders/:id/status", authenticate, authorize(["user", "admin"]), updateOrderStatus);

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
