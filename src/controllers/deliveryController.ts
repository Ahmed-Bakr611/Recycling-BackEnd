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
