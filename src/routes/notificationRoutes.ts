import express from "express";
import {
  getUserNotifications,
  markNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationsCount,
  deleteAllNotifications
} from "../controllers/notificationController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all notifications for the authenticated user
router.get("/", getUserNotifications);

// Get unread notifications count
router.get("/unread-count", getUnreadNotificationsCount);

// Mark notifications as read (bulk or all)
router.patch("/mark-read", markNotificationsAsRead);

// Mark a single notification as read
router.patch("/:id/mark-read", markNotificationAsRead);

// Delete a single notification
router.delete("/:id", deleteNotification);

// Delete all notifications for the user
router.delete("/", deleteAllNotifications);

export default router;
