// middleware/authenticate.ts

import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/users";

export interface TokenPayload {
  userId: string;
  role: string;
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.split(" ")[1];

  if (!accessToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET as string
    ) as TokenPayload;
    console.log("Decoded token in authenticate middleware:", decoded);

    req.user = decoded; // ✅ Now req.user = { userId, role }

    User.findByIdAndUpdate(decoded.userId, {
      lastActiveAt: new Date(),
    }).catch((err) => console.error("Failed to update lastActiveAt", err));

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }

    return res.status(403).json({ message: "Invalid access token" });
  }
};
