import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/profileController";
import { authenticate } from "../middlewares/authenticate";

import { deliveryStorage,fileFilter } from "../utils/cloudinary";
import { handleMulterError } from "../middlewares/multerError";




const upload = multer({ storage: deliveryStorage, fileFilter });

export default (appRouter: express.Router) => {
  appRouter.get("/profile", authenticate, getProfile);

  appRouter.put(
    "/profile",
    authenticate,
    upload.single("image"),
    handleMulterError,
    updateProfile
  );

  appRouter.delete("/profile", authenticate, deleteProfile);
};
