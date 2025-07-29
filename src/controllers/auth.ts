import { Request, Response } from "express";
import User from "../models/users";
import Otp from "../models/otp";
import { generateToken, createAndSendOtp, verifyOtp } from "../utils/helper";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import jwt from "jsonwebtoken";
import Cart from "../models/cart";

////////////////////////////////////////////////
// Sign Up logic
////////////////////////////////////////////////
export const initiateSignup = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    console.log(`Initiating signup for email: ${email}`);

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    await createAndSendOtp(email); // ✅ sends OTP to email
    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const verifyOtpAndRegister = async (req: Request, res: Response) => {
  try {
    console.log("Verifying OTP and registering user");
    console.log("Request body:", req.body);
    const { name, email, password, provider, phoneNumber, otpCode, role } =
      req.body;

    await verifyOtp(email, otpCode);
    const user = await User.create({
      name,
      email,
      password,
      provider: provider || "none",
      phoneNumber: phoneNumber.padStart(11, "0"),
      role: role || "customer", // set default role if you want
    });

    // Pass role when generating tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    // Save refreshToken in DB
    user.refreshToken = refreshToken;
    await user.save();

    res
      .status(201)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      })
      .header("Authorization", `Bearer ${accessToken}`)
      .json({ accessToken, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Signup failed" });
  }
};

////////////////////////////////////////////////
// Login logic
////////////////////////////////////////////////
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const sessionId = req.sessionId; // Get session ID from middleware
    const userId = user._id;
    // Find session-based cart items
    const sessionCart = await Cart.findOne({ sessionId });

    // Always check if user already has a cart (preserves cart after logout/login)
    let userCart = await Cart.findOne({ userId });

    if (sessionCart && sessionCart.items.length > 0) {
      if (!userCart) {
        // Create new user cart with session items
        userCart = new Cart({
          userId: userId,
          items: sessionCart.items
        });
        await userCart.save();
        console.log(`Created new user cart with ${sessionCart.items.length} items from session`);
      } else {
        // Merge session items with existing user cart
        for (const sessionItem of sessionCart.items) {
          // Check if this item already exists in user cart (by categoryId)
          const existingItemIndex = userCart.items.findIndex(
            item => item.categoryId === sessionItem.categoryId
          );
          
          if (existingItemIndex !== -1) {
            // Item exists, add quantities
            const existingItem = userCart.items[existingItemIndex];
            const newQuantity = existingItem.quantity + sessionItem.quantity;
            
            // Validate the new quantity based on measurement_unit
            const validateQuantity = (quantity: number, measurement_unit: number) => {
              if (measurement_unit === 1) { // KG items
                const multiplied = Math.round(quantity * 4);
                return multiplied >= 1 && Math.abs(quantity * 4 - multiplied) < 0.0001;
              } else { // Piece items
                return Number.isInteger(quantity) && quantity >= 1;
              }
            };
            
            if (validateQuantity(newQuantity, existingItem.measurement_unit)) {
              existingItem.quantity = newQuantity;
              // Update other fields from session item if needed
              existingItem.itemName = sessionItem.itemName;
              existingItem.image = sessionItem.image;
              existingItem.points = sessionItem.points;
              existingItem.price = sessionItem.price;
              existingItem.categoryName = sessionItem.categoryName;
            } else {
              // If new quantity is invalid, keep the existing quantity but log a warning
              console.warn(`Cannot merge item ${sessionItem.itemName}: invalid quantity ${newQuantity}`);
            }
          } else {
            // Item doesn't exist, add it to user cart
            userCart.items.push({
              categoryId: sessionItem.categoryId,
              categoryName: sessionItem.categoryName,
              itemName: sessionItem.itemName,
              image: sessionItem.image,
              points: sessionItem.points,
              price: sessionItem.price,
              measurement_unit: sessionItem.measurement_unit,
              quantity: sessionItem.quantity
            });
          }
        }
        await userCart.save();
        console.log(`Merged ${sessionCart.items.length} session items with existing user cart`);
      }
      
      // Delete session-based cart after successful transfer
      await Cart.deleteOne({ sessionId });
    } else {
      // No session cart, but user cart should persist from previous sessions
      if (userCart) {
        console.log(`User cart preserved with ${userCart.items.length} items`);
      }
    }
    
    // Pass user.role to token generation
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    // Store refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    res.clearCookie("sessionId");
    // Send access in header and JSON, and refresh in HTTP-only cookie
    res
      .status(200)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      })
      .header("Authorization", `Bearer ${accessToken}`)
      .json({ accessToken, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
};

////////////////////////////////////////////////
// Forgot Password logic
////////////////////////////////////////////////
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    console.log(`Forgot password request for email: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await createAndSendOtp(email);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    console.log("Resetting password");
    console.log("Request body:", req.body);
    const { email, otpCode, newPassword } = req.body;

    await verifyOtp(email, otpCode);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword;
    user.refreshToken = ""; // optional: log out from all devices
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Reset failed" });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.sendStatus(204);
    }

    // Find user and clear refresh token
    const user = await User.findOne({ refreshToken: token });
    if (user) {
      user.refreshToken = "";
      await user.save();
    }

    // Clear the cookie with same settings as when it was set
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.sendStatus(204);
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Logout failed" });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    console.log("🔍 === REFRESH TOKEN DEBUG START ===");
    console.log("📋 All cookies received:", req.cookies);
    console.log("📋 Cookie header raw:", req.headers.cookie);
    console.log("📋 Request method:", req.method);
    console.log("📋 Request URL:", req.url);
    console.log("🌍 NODE_ENV:", process.env.NODE_ENV);

    const token = req.cookies.refreshToken;
    console.log(
      "🎫 Refresh token from cookie:",
      token ? `EXISTS (length: ${token.length})` : "MISSING"
    );

    if (!token) {
      console.log("❌ No refresh token provided");
      return res.status(401).json({ message: "No refresh token provided" });
    }

    console.log(
      "🎫 Token preview:",
      `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
    );

    console.log(
      "🔑 JWT_REFRESH_SECRET exists:",
      !!process.env.JWT_REFRESH_SECRET
    );
    console.log(
      "🔑 JWT_ACCESS_SECRET exists:",
      !!process.env.JWT_ACCESS_SECRET
    );

    const decoded = verifyRefreshToken(token);
    console.log("🔓 Decoded token result:", decoded);

    if (!decoded) {
      console.log("❌ Token verification failed");
      try {
        const unverifiedDecoded = jwt.decode(token);
        console.log("🔍 Unverified token content:", unverifiedDecoded);
      } catch (decodeErr) {
        console.log("❌ Token is not even valid JWT:", decodeErr.message);
      }
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const userById = await User.findById(decoded.userId);
    console.log("👤 User found by ID:", userById ? "YES" : "NO");

    if (userById) {
      console.log("👤 User email:", userById.email);
      console.log(
        "🔄 Stored refresh token in DB exists:",
        !!userById.refreshToken
      );
      console.log(
        "🔄 Stored token preview:",
        userById.refreshToken
          ? `${userById.refreshToken.substring(
              0,
              10
            )}...${userById.refreshToken.substring(
              userById.refreshToken.length - 10
            )}`
          : "NONE"
      );
      console.log("🔄 Token matches exactly:", userById.refreshToken === token);

      if (userById.refreshToken && userById.refreshToken !== token) {
        console.log(
          "🔄 Token lengths - DB:",
          userById.refreshToken.length,
          "Request:",
          token.length
        );
        console.log(
          "🔄 First 50 chars match:",
          userById.refreshToken.substring(0, 50) === token.substring(0, 50)
        );
      }
    }

    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken: token,
    });

    console.log("👤 User found with matching token:", user ? "YES" : "NO");

    if (!user) {
      console.log("❌ User not found or token mismatch");
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Generate new tokens with role
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const newRefreshToken = generateRefreshToken(
      user._id.toString(),
      user.role
    );

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    console.log("✅ Success! Returning new access token");
    console.log("🔍 === REFRESH TOKEN DEBUG END ===");

    res.status(200).json({
      accessToken,
      message: "Token refreshed successfully",
    });
  } catch (err) {
    console.error("💥 Refresh token error:", err);
    console.error("💥 Error stack:", err.stack);
    res.status(401).json({ message: "Invalid refresh token" });
  }
};
export const validateToken = async (req: Request, res: Response) => {
  res.status(200).json({
    message: "Access token is valid",
    user: req.user, // includes userId and role
  });
};
