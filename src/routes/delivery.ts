// routes/delivery.ts
import express from "express";
import multer from "multer";
import { deliveryAttachmentStorage } from "../utils/cloudinary";
import {
  registerDeliveryUser,
  getAllDeliveries,
  getDeliveryById,
  updateDelivery,
  approveDeliveryUser,
  submitDeliveryReview,
  getDeliveryReview,
  updateDeliveryReview,
  getCourierReviews,
  getUserReviewHistory,
  getReviewableOrders,
  deleteDeliveryReview,
  fixCourierStats,
} from "../controllers/deliveryController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { reapplyDeliveryUser, revokeDeliveryUser } from "../controllers/auth";
const upload = multer({ storage: deliveryAttachmentStorage });

export default (appRouter: express.Router) => {
  appRouter.post(
    "/registerDelivery",
    upload.fields([
      { name: "deliveryImage", maxCount: 1 },
      { name: "vehicleImage", maxCount: 1 },
      { name: "criminalRecord", maxCount: 1 },
    ]),
    registerDeliveryUser
  );
  // Admin: Get all delivery users
  appRouter.get(
    "/deliveries",
    authenticate,
    authorize(["admin"]),
    getAllDeliveries
  );

  // Admin: Get delivery user by ID
  appRouter.get(
    "/delivery/:id",
    authenticate,
    authorize(["admin"]),
    getDeliveryById
  );

  // Admin: Approve/reject delivery user
  appRouter.patch(
    "/delivery/:id/approve",
    authenticate,
    authorize(["admin"]),
    approveDeliveryUser
  );

  // Admin: Generic update to delivery user
  appRouter.patch(
    "/delivery/:id",
    authenticate,
    authorize(["admin"]),
    updateDelivery
  );

  appRouter.post(
    "/delivery/reapply",

    reapplyDeliveryUser
  );
  appRouter.patch(
    "/delivery/revoke/:userId",
    authenticate,
    authorize(["admin"]),
    revokeDeliveryUser
  );

  appRouter.post(
    "/:orderId/review",
    authenticate,
    authorize(["customer", "buyer"]), // Only customers and buyers can review
    submitDeliveryReview
  );

  // Get delivery review for a specific order
  // GET /api/orders/:orderId/review
  appRouter.get(
    "/:orderId/review",
    authenticate,
    authorize(["customer", "buyer"]),
    getDeliveryReview
  );

  // Update/Edit a delivery review
  // PUT /api/orders/:orderId/review
  appRouter.put(
    "/:orderId/review",
    authenticate,
    authorize(["customer", "buyer"]),
    updateDeliveryReview
  );

  // Get all reviews for a specific courier (public endpoint for courier profiles)
  // GET /api/reviews/courier/:courierId
  appRouter.get("/reviews/courier/:courierId", getCourierReviews);

  // Get current user's review history
  // GET /api/reviews/my-reviews
  appRouter.get(
    "/reviews/my-reviews",
    authenticate,
    authorize(["customer", "buyer"]),
    getUserReviewHistory
  );
  appRouter.get("/reviewable-orders", authenticate, getReviewableOrders);
  appRouter.delete("/:orderId/review", authenticate, deleteDeliveryReview);
  appRouter.patch('/courier/:courierId/fix-stats', fixCourierStats);


};
