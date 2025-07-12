import express from "express";
import {
  signup,
  sendOtpForSignup,
  verifyOtpAndRegister,
} from "../controllers/auth";

export default (router: express.Router) => {
  router.post("/auth/send", sendOtpForSignup);
  router.post("/auth/verify", verifyOtpAndRegister);
  return router;
};
