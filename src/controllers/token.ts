import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import User from "../models/users";
import { Request, Response } from "express";
// route: POST /auth/refresh

interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export const refreshAccessToken = async (req: Request, res: Response) => {
  console.log("generate access token");
  console.log(req);
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(
      token,
      process.env.REFRESH_SECRET!
    ) as JwtPayload;
    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id.toString());
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Invalid or expired refresh token" });
  }
};
