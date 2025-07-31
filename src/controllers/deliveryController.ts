// controllers/deliveryController.ts
import { Request, Response } from "express";
import User from "../models/users";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

export const registerDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phoneNumber, provider } = req.body;

    const attachmentsFromBody = JSON.parse(req.body.attachments || "{}");

    const files = req.files as Record<string, Express.Multer.File[]>;

    const attachments = {
      ...attachmentsFromBody,
      deliveryImage: files?.deliveryImage?.[0]?.path || null,
      vehicleImage: files?.vehicleImage?.[0]?.path || null,
      criminalRecord: files?.criminalRecord?.[0]?.path || null,
    };

    const user = await User.create({
      name,
      email,
      password,
      phoneNumber: phoneNumber?.padStart(11, "0"),
      provider: provider,
      role: "delivery",
      attachments,
      isApproved: false, // for admin approval
    });

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    return res
      .status(201)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      })
      .header("Authorization", `Bearer ${accessToken}`)
      .json({ accessToken, user });
  } catch (err) {
    console.error("Register delivery error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Delivery registration failed" });
  }
};

export const getAllDeliveries = async (req: Request, res: Response) => {
  try {
    const deliveries = await User.find({ role: "delivery" }).select(
      "name email phoneNumber isApproved attachments createdAt"
    );

    return res.status(200).json({ deliveries });
  } catch (err) {
    console.error("Get deliveries error:", err);
    return res.status(500).json({ message: "Failed to fetch delivery users" });
  }
};
export const getDeliveryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: "delivery" }).select(
      "name email phoneNumber isApproved attachments createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Delivery user not found" });
    }

    return res.status(200).json({ delivery: user });
  } catch (err) {
    console.error("Get delivery by ID error:", err);
    return res.status(500).json({ message: "Failed to fetch delivery user" });
  }
};
export const approveDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    ).select("name email isApproved");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Approval status updated", user });
  } catch (err) {
    console.error("Update approval error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update approval status" });
  }
};
export const updateDelivery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { _id: id, role: "delivery" },
      updates,
      { new: true }
    ).select("name email phoneNumber isApproved attachments");

    if (!user) {
      return res.status(404).json({ message: "Delivery user not found" });
    }

    return res.status(200).json({ message: "Delivery user updated", user });
  } catch (err) {
    console.error("Update delivery error:", err);
    return res.status(500).json({ message: "Failed to update delivery user" });
  }
};
