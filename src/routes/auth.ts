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
  /**
   * @swagger
   * /auth/initiateSignup:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Initiate Signup by sending OTP
   *     description: Sends a One-Time Password (OTP) to the user's email for verification during signup.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *     responses:
   *       200:
   *         description: OTP sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: OTP sent to your email
   *       409:
   *         description: Email already registered
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Email already registered
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to send OTP
   */
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
