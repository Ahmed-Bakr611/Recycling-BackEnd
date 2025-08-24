import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/users";
import { generateAccessToken } from "../utils/jwt";

// ✅ يدعم أكتر من client (موبايل + ويب)
const googleClient = new OAuth2Client();

export const googleCheckFirstTime = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Missing Google ID token" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID!,
        process.env.GOOGLE_MOBILE_CLIENT_ID!,
      ],
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const { email, name, picture } = payload;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role === "delivery" && !existingUser.isApproved) {
        return res.status(401).json({ message: "Delivery Not Approved Yet" });
      }

      if (existingUser.provider === "none") {
        return res.status(400).json({
          exists: false,
          message: "This email is registered with password login, not Google",
        });
      }

      const accessToken = generateAccessToken(
        existingUser.id,
        existingUser.role
      );
      return res
        .status(200)
        .json({ exists: true, user: existingUser, accessToken });
    }

    // أول مرة
    return res.status(200).json({
      exists: false,
      user: {
        email,
        name,
        image: picture,
        provider: "google",
      },
    });
  } catch (err) {
    console.error("Google check error:", err);
    res.status(500).json({ message: "Failed to verify Google token" });
  }
};
