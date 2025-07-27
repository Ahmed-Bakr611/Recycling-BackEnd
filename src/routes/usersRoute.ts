import express from "express";
import multer from "multer";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  getUserStats,
  searchUsers,
  updateUserByAdmin,
  // Add these new imports for points management
  addUserPoints,
  deductUserPoints,
  getUserPoints,
  getPointsLeaderboard,
} from "../controllers/userController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import {
  getOrderAnalyticsWithPoints,
  getUserOrdersWithPoints,
  recalculateUserPointsFromOrders,
} from "../controllers/pickupController";
import {
  createPaymentIntent,
  createStripeCustomer,
  getAllPayments,
  getAllPaymentsForUser,
  createCheckoutSession,
} from "../controllers/stripePayment";

export default (appRouter: express.Router) => {
  // User stats
  appRouter.get("/stats", getUserStats);

  // User management (admin only)
  appRouter.get("/users", authenticate, authorize(["admin"]), getAllUsers);
  appRouter.get("/users/:id", authenticate, getUserById);
  appRouter.delete(
    "/users/:id",
    authenticate,
    authorize(["admin"]),
    deleteUser
  );
  appRouter.patch(
    "/users/:id",
    authenticate,
    authorize(["admin"]),
    updateUserByAdmin
  );
  appRouter.get(
    "/users/search",
    authenticate,
    authorize(["admin"]),
    searchUsers
  );

  // User Points Management
  appRouter.post("/users/:userId/points/add", authenticate, addUserPoints);
  appRouter.post(
    "/users/:userId/points/deduct",
    authenticate,
    authorize(["admin", "customer"]),
    deductUserPoints
  );

  appRouter.get("/users/:userId/points", authenticate, getUserPoints); // This is the one your frontend needs
  appRouter.get(
    "/users/points/leaderboard",
    authenticate,
    getPointsLeaderboard
  );

  // Order-related points routes
  appRouter.get(
    "/user/orders-with-points",
    authenticate,
    getUserOrdersWithPoints
  );
  appRouter.get(
    "/analytics/with-points",
    authenticate,
    authorize(["admin"]),
    getOrderAnalyticsWithPoints
  );
  appRouter.get("/top-users-by-stored-points", getPointsLeaderboard);
  appRouter.post(
    "/recalculate-points/:userId",
    authenticate,
    authorize(["admin"]),
    recalculateUserPointsFromOrders
  );
  appRouter.post(
    "/users/:id/stripe-customer",
    authenticate,
    createStripeCustomer
  );

  // Route to create payment intent for user
  appRouter.post(
    "/users/:id/create-payment-intent",
    authenticate,
    createPaymentIntent
  );
  appRouter.post(
    "/users/:id/create-checkout-session",
    authenticate,
    createCheckoutSession
  );

  appRouter.get("/users/:id/payments", authenticate, getAllPaymentsForUser);

  appRouter.get(
    "/payments",
    authenticate,
    authorize(["admin"]),
    getAllPayments
  );
};
