
import express from "express";
import {
  cancelOrder,
  createOrder,
  deleteAllOrders,
  deleteOrderById,
  getAllOrders,
  getAllOrdersForAdmin,
  getOrderAnalytics,
  getOrderById,
  getOrdersByStatus,
  getTopCitiesByOrders,
  getTopMaterialsRecycled,
  getUserOrdersWithPoints,
  updateOrderStatus,
  updateOrderStatusByAdmin,
} from "../controllers/pickupController";
import { authorize } from "../middlewares/authorize";
import { authenticate } from "../middlewares/authenticate";
import { completeOrderWithProof, uploadProof } from "../controllers/courierController";

export default (router: express.Router) => {
  router.get("/orders/analytics/top-cities", getTopCitiesByOrders);

  router.get('/top-materials-recycled', getTopMaterialsRecycled);
  // router.get('/top-users-points', getTopUsersByStoredPoints);


router.get("/orders", authenticate, authorize(["customer", "buyer", "admin"]), getAllOrders);
router.get("/orders/points", authenticate, authorize(["customer", "buyer", "admin"]), getUserOrdersWithPoints);
router.post("/orders", authenticate,  authorize(["customer", "buyer", "admin"]), createOrder);
router.get('/orders/analytics', getOrderAnalytics);

router.get("/orders/:id", authenticate, authorize(["customer", "buyer", "admin"]), getOrderById);
router.delete("/orders/:id", authenticate, authorize(["customer", "buyer", "admin"]), deleteOrderById);
router.delete("/orders", authenticate, authorize(["customer", "buyer", "admin"]), deleteAllOrders);
router.get("/orders/status/:status", authenticate, authorize(["customer", "buyer", "admin"]), getOrdersByStatus);
router.put("/orders/:id/status", authenticate, authorize(["customer", "buyer", "admin"]), updateOrderStatus);

// 🛡️ ADMIN routes
router.get("/admin/orders", authenticate, authorize(["admin"]), getAllOrdersForAdmin);
router.put("/admin/orders/:id/status", authenticate, authorize(["admin"]), updateOrderStatusByAdmin);
  router.delete("/admin/orders/:id", authenticate, authorize(["admin"]), deleteOrderById);

router.patch(
  "/orders/:id/cancel",
  authenticate,
  authorize(["customer", "buyer", "admin"]),
  cancelOrder
)
router.post('/:orderId/complete-with-proof',
  authenticate 
  , 
  authorize(['delivery']),
  uploadProof.single('proofPhoto'),
  completeOrderWithProof
);
  return router;
};
