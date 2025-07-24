import express from "express";
import {
  initiateSignup,
  verifyOtpAndRegister,
  login,
  forgotPassword,
  resetPassword,
  logout,
  refreshToken,
  validateToken,
} from "../controllers/auth";
import { refreshAccessToken } from "../controllers/token";
import { authenticate } from "../middlewares/authenticate";

export default (router: express.Router) => {
  router.post("/auth/initiateSignup", initiateSignup);
  router.post("/auth/verifyRegisterToken", verifyOtpAndRegister);
  router.post("/auth/login", login);
  router.post("/auth/forgotPassword", forgotPassword);
  router.post("/auth/resetPassword", resetPassword);
  router.post("/auth/refresh", refreshToken);
  router.post("/auth/logout", logout);
  router.get("/auth/validate", authenticate, validateToken);
  // router.post("/auth/refreshToken", refreshToken);

  return router;
};
