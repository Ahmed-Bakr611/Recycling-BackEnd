// routes/delivery.ts
import express from "express";
import multer from "multer";
import { registerDeliveryUser } from "../controllers/deliveryController";
import { deliveryAttachmentStorage } from "../utils/cloudinary";

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
};
