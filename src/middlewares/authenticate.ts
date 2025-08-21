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

    console.log("start authenticate middleware");
    console.log("user Id", decoded.userId);

    User.findById(decoded.userId)
      .then(async (userDoc) => {
        if (!userDoc) {
          console.log("User not found!");
          return res.status(404).json({ message: "User not found" });
        }

        // Update last active
        userDoc.lastActiveAt = new Date();
        await userDoc.save();

        if (userDoc.isBlocked) {
          return res
            .status(403)
            .json({ message: "Account blocked due to repeated reports" });
        }

        console.log("end authenticate Middleware");
        next();
      })
      .catch((err) => {
        console.error("Failed in authenticate middleware", err);
        return res.status(500).json({ message: "Auth check failed" });
      });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }

    return res.status(403).json({ message: "Invalid access token" });
  }
};

export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.split(" ")[1];

  if (!accessToken) {
    return next(); // No token — treat as guest
  }

  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET as string
    ) as TokenPayload;

    req.user = decoded;

    User.findByIdAndUpdate(decoded.userId, {
      lastActiveAt: new Date(),
    }).catch((err) => console.error("Failed to update lastActiveAt", err));

    next();
  } catch (err: any) {
    // Invalid or expired token — continue as guest
    console.log("Optional auth: invalid token, skipping user");
    next();
  }
};