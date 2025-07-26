import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/users";
import { SignOptions } from "jsonwebtoken";

interface TokenPayload {
  userId: string;
}

export const authenticate = async (
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

    req.user = decoded;
    return next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "Access token expired" });
      }

      try {
        const payload = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET as string
        ) as TokenPayload;

        const user = await User.findById(payload.userId);
        if (!user || user.refreshToken !== refreshToken) {
          return res.status(403).json({ message: "Invalid refresh token" });
        }

        const load = { userId: user._id.toString() };
        const secret = process.env.JWT_ACCESS_SECRET as string;
        const options: SignOptions = {
          expiresIn: "15m",
        };

const newAccessToken = jwt.sign(load, secret, options);
        res.setHeader("x-access-token", newAccessToken);
        req.user = { userId: user._id.toString() };

        return next();
      } catch (refreshErr) {
        return res
          .status(403)
          .json({ message: "Refresh token invalid or expired" });
      }
    }

    return res.status(403).json({ message: "Invalid token" });
  }
};
