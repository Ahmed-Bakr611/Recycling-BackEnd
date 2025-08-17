import mongoose from "mongoose";
import Notification, { INotification, MultiLangMessage } from "../models/notification";
import { getSocketIO } from "../socket/socketServer";

export interface NotificationData {
  userId: string;
  title: MultiLangMessage;
  body: MultiLangMessage;
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
      io.to(`user_${notificationData.userId}`).emit("notification:new", {
        id: savedNotification._id,
        title: savedNotification.title,
        body: savedNotification.body,
        type: savedNotification.type,
        orderId: savedNotification.orderId,
        data: savedNotification.data,
        isRead: savedNotification.isRead,
        createdAt: savedNotification.createdAt,
      });

      console.log(
        `✅ Notification emitted to user ${notificationData.userId}:`,
        savedNotification.title.en
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
    title: {
      en: "Order Assigned",
      ar: "تم تعيين الطلب"
    },
    body: {
      en: "Your order has been assigned to a courier. Expect them within 48 hours.",
      ar: "تم تعيين طلبك إلى ساعي البريد. توقعه خلال 48 ساعة."
    },
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
    title: {
      en: "Order Cancelled",
      ar: "تم إلغاء الطلب"
    },
    body: {
      en: `Your order was cancelled. Reason: ${reason}`,
      ar: `تم إلغاء طلبك. السبب: ${reason}`
    },
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
    title: {
      en: "Order Completed",
      ar: "تم إكمال الطلب"
    },
    body: {
      en: "Your recycling order has been completed successfully. Thank you for contributing to a cleaner environment!",
      ar: "تم إكمال طلب إعادة التدوير بنجاح. شكرًا لك على المساهمة في بيئة أنظف!"
    },
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
  let title: MultiLangMessage;
  let body: MultiLangMessage;

  // Default title
  title = {
    en: "Order Status Updated",
    ar: "تم تحديث حالة الطلب"
  };

  switch (newStatus) {
    case "pending":
      body = {
        en: "Your order is now pending review.",
        ar: "طلبك الآن في انتظار المراجعة."
      };
      break;
    case "assigntocourier":
      body = {
        en: "Your order has been assigned to a courier. Expect them within 48 hours.",
        ar: "تم تعيين طلبك إلى ساعي البريد. توقعه خلال 48 ساعة."
      };
      break;
    case "completed":
      body = {
        en: "Your recycling order has been completed successfully!",
        ar: "تم إكمال طلب إعادة التدوير بنجاح!"
      };
      break;
    case "cancelled":
      body = {
        en: "Your order has been cancelled.",
        ar: "تم إلغاء طلبك."
      };
      break;
    default:
      body = {
        en: `Your order status has been updated from ${oldStatus} to ${newStatus}.`,
        ar: `تم تحديث حالة طلبك من ${oldStatus} إلى ${newStatus}.`
      };
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
