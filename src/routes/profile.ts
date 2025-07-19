import express from "express";
import multer from "multer";
import {
  getProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/profileController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { userStorage } from "../utils/cloudinary";

const upload = multer({ storage: userStorage });

export default (appRouter: express.Router) => {
  appRouter.get("/profile", authenticate, getProfile);

  // ✅ Include image upload middleware
  appRouter.put(
    "/profile",
    authenticate,
    upload.single("image"),
    updateProfile
  );

  appRouter.delete("/profile", authenticate, deleteProfile);
};
