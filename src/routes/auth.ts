import express from "express";
import {
  initiateSignup,
  login,
  forgotPassword,
  resetPassword,
  logout,
  refreshToken,
  validateToken,
  verifyOtpSentToUser,
  RegisterNewUser,
  getDeliveryAttachments,
  declineDeliveryUser,
  approveDeliveryUser,
  getDeliveryStatus,
} from "../controllers/auth";
import { refreshAccessToken } from "../controllers/token";
import { authenticate } from "../middlewares/authenticate";
import { generateRefreshToken } from "utils/jwt";
import { googleCheckFirstTime } from "../controllers/provider";

export default (router: express.Router) => {
  router.post("/auth/initiateSignup", initiateSignup);
  router.post("/auth/verifyOtp", verifyOtpSentToUser);
  router.post("/auth/register", RegisterNewUser);

  router.post("/auth/login", login);
  router.post("/auth/forgotPassword", forgotPassword);
  router.post("/auth/resetPassword", resetPassword);
  router.post("/auth/refresh", refreshToken);
  router.post("/auth/logout", logout);
  router.get("/auth/validate", authenticate, validateToken);
  router.post("/auth/provider/google", googleCheckFirstTime);
router.get('/delivery-attachments', getDeliveryAttachments);
router.patch("/delivery/approve/:userId", approveDeliveryUser);
router.patch("/delivery/decline/:userId", declineDeliveryUser);
router.get("/delivery-status", authenticate, getDeliveryStatus);
  // router.post("/auth/refreshToken", refreshToken);

  return router;
};
