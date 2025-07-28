import { Request, Response, NextFunction } from "express";
import Session from "../models/session";

export const sessionMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId =
      req.cookies?.sessionId || (req.headers["x-session-id"] as string);

    if (!sessionId) {
      return next(); // No session provided (guest)
    }

    const session = await Session.findOne({ sessionId, isValid: true });

    if (session) {
      // Attach session to request
      req.session = session;

      // Update last used time (for activity tracking)
      session.lastUsedAt = new Date();
      await session.save();
    }
  } catch (err) {
    console.warn("Session middleware error:", err);
  }

  return next();
};
