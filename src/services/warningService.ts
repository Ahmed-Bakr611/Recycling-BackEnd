import mongoose from "mongoose";
import User from "../models/users";
import Report from "../models/report";

const WARNING_THRESHOLD = 3;

export async function fileDeliveryReport(params: {
  reportedUserId: string;
  reporterId: string;
  reason: string;
  orderId?: string;
}) {
  const { reportedUserId, reporterId, reason, orderId } = params;
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const deliveryUser = await User.findById(reportedUserId).session(session);
      if (!deliveryUser) throw new Error("Reported user not found");
      if (deliveryUser.role !== "delivery") throw new Error("Only delivery users can be reported");
      if (deliveryUser.isBlocked) return deliveryUser;

      try {
        await Report.create(
          [
            {
              reporterId: new mongoose.Types.ObjectId(reporterId),
              reportedUserId: new mongoose.Types.ObjectId(reportedUserId),
              reason,
              orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
            },
          ],
          { session }
        );
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        return deliveryUser;
      }

      const fresh = await User.findById(reportedUserId).session(session).exec();
      const currentCount = fresh?.warningsCount ?? 0;
      const nextCount = currentCount + 1;

      fresh!.warningsCount = nextCount;
      fresh!.warnings = [
        ...(fresh!.warnings || []),
        { reporterId, reason, orderId, createdAt: new Date() } as any,
      ];

      if (nextCount >= WARNING_THRESHOLD) {
        fresh!.isBlocked = true;
        fresh!.blockedAt = new Date();
        fresh!.blockReason = `Auto-blocked after ${WARNING_THRESHOLD} warnings`;
      }

      await fresh!.save({ session });
      return fresh!.toSafeObject ? fresh!.toSafeObject() : fresh!;
    });
  } finally {
    session.endSession();
  }
}


