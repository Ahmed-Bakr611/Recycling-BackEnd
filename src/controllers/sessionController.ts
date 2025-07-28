import { Request, Response } from "express";
import Session from "../models/session";
import { v4 as uuidv4 } from "uuid";

// Create guest session
export const createGuestSession = async (req: Request, res: Response) => {
  const sessionId = uuidv4();

  const session = await Session.create({
    sessionId,
    device: req.headers["x-device-type"] || "unknown",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  res
    .cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
    .status(201)
    .json({ sessionId });
};

// List all sessions for authenticated user
export const getUserSessions = async (req: Request, res: Response) => {
  const userId = req.user.userId;

  const sessions = await Session.find({ userId }).select("-refreshToken");
  res.status(200).json(sessions);
};

// Logout (invalidate session)
export const invalidateSession = async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  await Session.updateOne({ sessionId }, { isValid: false });
  res.status(200).json({ message: "Session invalidated" });
};

// Optional: upgrade guest session to user session
export const upgradeGuestSession = async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const userId = req.user.userId;

  await Session.updateOne({ sessionId }, { userId });
  res.status(200).json({ message: "Session upgraded to user" });
};
