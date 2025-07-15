import jwt from "jsonwebtoken";

// Ensure your secrets are NOT undefined
const accessSecret = process.env.JWT_ACCESS_SECRET as string;
const refreshSecret = process.env.JWT_REFRESH_SECRET as string;

interface TokenPayload {
  userId: string;
}

export const generateAccessToken = (userId: string): string => {
  const payload: TokenPayload = { userId };

  return jwt.sign(payload, accessSecret, {
    expiresIn: "15m", // Can also use: process.env.ACCESS_TOKEN_EXPIRES || "15m"
  });
};

export const generateRefreshToken = (userId: string): string => {
  const payload: TokenPayload = { userId };

  return jwt.sign(payload, refreshSecret, {
    expiresIn: "7d", // Can also use: process.env.REFRESH_TOKEN_EXPIRES || "7d"
  });
};
