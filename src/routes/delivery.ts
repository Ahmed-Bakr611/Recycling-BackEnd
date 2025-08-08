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

  appRouter.post("/delivery/reapply", 

  reapplyDeliveryUser
);
appRouter.patch("/delivery/revoke/:userId", authenticate, authorize(['admin']), revokeDeliveryUser);

};
