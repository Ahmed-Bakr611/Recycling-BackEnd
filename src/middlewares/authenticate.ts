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
    User.findByIdAndUpdate(decoded.userId, {
      lastActiveAt: new Date(),
    })
      .then((res) => {
        if (!res) console.log("User not found!");
        else console.log("User updated:", res._id);
      })
      .catch((err) => console.error("Failed to update lastActiveAt", err));

    console.log("end authenticate Middleware");

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }

    return res.status(403).json({ message: "Invalid access token" });
  }
};
