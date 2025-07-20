import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/users";

const WHITELIST_ROUTES = ["/auth/login", "/auth/register", "/auth/refresh"];

export const updateLastActive = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const skip = WHITELIST_ROUTES.some((path) => req.path.startsWith(path));
  if (skip) return next();

  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return next(); // Not an authenticated request

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string
    ) as { userId: string };

    // Optional: attach to req
    req.user = decoded;

    // Update last active
    await User.findByIdAndUpdate(decoded.userId, {
      lastActiveAt: new Date(),
    });

    next();
  } catch (err) {
    // Invalid token? Continue without updating
    next();
  }
};
