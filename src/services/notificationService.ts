import mongoose from "mongoose";
import Notification, { INotification } from "../models/notification";
import { getSocketIO } from "../socket/socketServer";

export interface NotificationData {
  userId: string;
  title: string;
  body: string;
  type:
    | "order_status"
    | "order_assigned"
    | "order_cancelled"
    | "order_completed"
    | "system";
  orderId?: string;
  data?: any;
}

// Create and emit a notification
export const createAndEmitNotification = async (
  notificationData: NotificationData
): Promise<INotification | null> => {
  try {
    // Create notification in database
    const notification = new Notification({
      userId: new mongoose.Types.ObjectId(notificationData.userId),
      title: notificationData.title,
      body: notificationData.body,
      type: notificationData.type,
      orderId: notificationData.orderId
        ? new mongoose.Types.ObjectId(notificationData.orderId)
        : undefined,
      data: notificationData.data,
      isRead: false,
    });

    const savedNotification = await notification.save();

    // Populate the order information if orderId exists
    await savedNotification.populate("orderId", "status createdAt");

    // Emit real-time notification to the user if they are connected
    const io = getSocketIO();
    if (io) {
      // Normalize order data in notification payload if present
      const orderPayload = savedNotification.orderId ? (() => {
        try {
          const o: any = savedNotification.orderId;
          const orderObj = o.toObject ? o.toObject() : o;
          const items = Array.isArray(orderObj.items)
            ? orderObj.items.map((it: any) => ({
                ...it,
                name: it.nameObj || (it.name ? (typeof it.name === 'string' ? { en: it.name } : it.name) : { en: '' }),
                itemSlug: it.itemSlug || it.slug || (it.name && typeof it.name === 'string' ? it.name : (it.name?.en || ''))
              }))
            : [];

          return { id: orderObj._id, status: orderObj.status, items };
        } catch (e) {
          return savedNotification.orderId;
        }
      })() : undefined;

      io.to(`user_${notificationData.userId}`).emit("notification:new", {
        id: savedNotification._id,
        title: savedNotification.title,
        body: savedNotification.body,
        type: savedNotification.type,
        order: orderPayload,
        data: savedNotification.data,
        isRead: savedNotification.isRead,
        createdAt: savedNotification.createdAt,
      });

      console.log(
        `✅ Notification emitted to user ${notificationData.userId}:`,
        savedNotification.title
      );
    }

    return savedNotification;
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    return null;
  }
};

// Helper functions for specific notification types
export const createOrderAssignedNotification = async (
  userId: string,
  orderId: string
): Promise<void> => {
  await createAndEmitNotification({
    userId,
    title: "Order Assigned",
    body: "Your order has been assigned to a courier. Expect them within 48 hours.",
    type: "order_assigned",
    orderId,
  });
};

export const createOrderCancelledNotification = async (
  userId: string,
  orderId: string,
  reason: string
): Promise<void> => {
  await createAndEmitNotification({
    userId,
    title: "Order Cancelled",
    body: `Your order was cancelled. Reason: ${reason}`,
    type: "order_cancelled",
    orderId,
    data: { cancelReason: reason },
  });
};

export const createOrderCompletedNotification = async (
  userId: string,
  orderId: string
): Promise<void> => {
  await createAndEmitNotification({
    userId,
    title: "Order Completed",
    body: "Your recycling order has been completed successfully. Thank you for contributing to a cleaner environment!",
    type: "order_completed",
    orderId,
  });
};

export const createOrderStatusChangeNotification = async (
  userId: string,
  orderId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  let title = "Order Status Updated";
  let body = `Your order status has been updated from ${oldStatus} to ${newStatus}.`;

  switch (newStatus) {
    case "pending":
      body = "Your order is now pending review.";
      break;
    case "assigntocourier":
      body =
        "Your order has been assigned to a courier. Expect them within 48 hours.";
      break;
    case "completed":
      body = "Your recycling order has been completed successfully!";
      break;
    case "cancelled":
      body = "Your order has been cancelled.";
      break;
  }

  await createAndEmitNotification({
    userId,
    title,
    body,
    type: "order_status",
    orderId,
    data: { oldStatus, newStatus },
  });
};
