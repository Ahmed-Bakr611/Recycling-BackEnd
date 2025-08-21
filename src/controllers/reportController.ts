import { Request, Response } from "express";
import { fileDeliveryReport } from "../services/warningService";

export const reportDeliveryUser = async (req: Request, res: Response) => {
  try {
    const reporterId = (req.user as any)?.userId;
    if (!reporterId) return res.status(401).json({ message: "Unauthorized" });

    const { deliveryUserId } = req.params;
    const { reason, orderId } = req.body;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const updatedUser = await fileDeliveryReport({
      reportedUserId: deliveryUserId,
      reporterId,
      reason: reason.trim(),
      orderId,
    });

    if ((updatedUser as any).isBlocked) {
      return res.status(200).json({
        message: "Report filed. Delivery user has been blocked after multiple warnings.",
        user: updatedUser,
      });
    }

    return res.status(201).json({
      message: "Report filed successfully",
      warningsCount: (updatedUser as any).warningsCount ?? 0,
      user: updatedUser,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to file report";
    if (/delivery users/.test(msg)) return res.status(400).json({ message: msg });
    if (/not found/.test(msg)) return res.status(404).json({ message: msg });
    return res.status(500).json({ message: "Failed to file report" });
  }
};


