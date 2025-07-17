// routes/orderRoute.ts
import { Router } from "express";
import { createOrder, getAllOrders } from "../controllers/pickupController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

export default (router: Router) => {
  router.post(
    "/orders",
    authenticate,
    authorize(["customer", "admin"]),
    createOrder
  );
  router.get("/orders", authenticate, authorize(["admin"]), getAllOrders);
};
