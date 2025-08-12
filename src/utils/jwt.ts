import jwt from "jsonwebtoken";

// Ensure your secrets are NOT undefined
const accessSecret = process.env.JWT_ACCESS_SECRET as string;
const refreshSecret = process.env.JWT_REFRESH_SECRET as string;

interface TokenPayload {
  userId: string;
  role: string; // ✅ Add this
}

export const generateAccessToken = (userId: string, role: string): string => {
  const payload: TokenPayload = { userId, role };

  return jwt.sign(payload, accessSecret, {
    expiresIn: "7d",
  });
};
export const generateRefreshToken = (userId: string, role: string): string => {
  console.log("gernerating Refresh Tokenn ..............");
  console.log(userId);
  const payload: TokenPayload = { userId, role };

  return jwt.sign(payload, refreshSecret, {
    expiresIn: "7d", // Can also use: process.env.REFRESH_TOKEN_EXPIRES || "7d"
  });
};
export const verifyAccessToken = (token: string) => {
  try {
    return jwt.verify(token, accessSecret) as TokenPayload;
  } catch (err) {
    return null;
  }
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, refreshSecret) as TokenPayload;
  } catch (err) {
    console.error("JWT verification error:", err.message);
    console.error("Error name:", err.name);
    if (err.name === "TokenExpiredError") {
      console.error("Token expired at:", err.expiredAt);
    }
    return null;
  }
};
