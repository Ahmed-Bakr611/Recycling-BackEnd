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
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

export const verifyOtpSentToUser = async (req: Request, res: Response) => {
  try {
    console.log("Verifying OTP and registering user");
    console.log("Request body:", req.body);
    const { email, otpCode } = req.body;

    await verifyOtp(email, otpCode);

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Signup failed" });
  }
};

export const RegisterNewUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      provider,
      phoneNumber,
      role,
      imgUrl,
      attachments,
      idToken, // used if provider is Google
    } = req.body;

    let user;

    if (provider === "google") {
      if (!idToken) {
        return res.status(400).json({ message: "Google ID token is required" });
      }

      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        return res.status(400).json({ message: "Invalid Google token" });
      }

      // Check if user already exists
      user = await User.findOne({ email: payload.email });
      if (!user) {
        user = await User.create({
          name: payload.name || name,
          email: payload.email,
          provider: "google",
          phoneNumber: phoneNumber?.padStart(11, "0") || "",
          role: role || "customer",
          imgUrl: payload.picture || imgUrl,
          // ✅ FIX: Set initial pending status for delivery users
          attachments:
            role === "delivery"
              ? {
                  status: "pending",
                  submittedAt: new Date(),
                  ...attachments,
                }
              : attachments || {},
          // ✅ FIX: Delivery users start as not approved
          isApproved: role === "delivery" ? false : true,
        });
      }
    } else {
      // Traditional email/password registration
      user = await User.create({
        name,
        email,
        password,
        provider: provider || "none",
        phoneNumber: phoneNumber.padStart(11, "0"),
        role: role || "customer",
        imgUrl: imgUrl,
        // ✅ FIX: Set initial pending status for delivery users
        attachments:
          role === "delivery"
            ? {
                status: "pending",
                submittedAt: new Date(),
                ...attachments,
              }
            : attachments || {},
        // ✅ FIX: Delivery users start as not approved
        isApproved: role === "delivery" ? false : true,
      });
    }

    // Create tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    user.refreshToken = refreshToken;
    await user.save();

    return res
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
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Signup failed" });
  }
};

////////////////////////////////////////////////
// Login logic
////////////////////////////////////////////////
// Updated login function with enhanced delivery user handling
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);
    if (user.provider === "none" && !match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Enhanced delivery user status handling
    if (user.role === "delivery") {
      const declineReason = user.attachments?.declineReason || null;
      const declinedAt = user.attachments?.declinedAt || null;
      const approvedAt = user.attachments?.approvedAt || null;
      const status = user.attachments?.status || "pending";
      const declineTimestamp = declinedAt ? new Date(declinedAt).getTime() : 0;
      const approveTimestamp = approvedAt ? new Date(approvedAt).getTime() : 0;
      // Case 1: User is declined - redirect to waiting page with decline reason
      if (
        declineReason &&
        (!approvedAt || declineTimestamp > approveTimestamp)
      ) {
        return res.status(200).json({
          message: "Delivery application declined",
          deliveryStatus: "declined",
          redirectTo: "/waitingforapproval",
          user: {
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isApproved: false,
          },
          declineReason,
          declinedAt,
          canReapply: true,
        });
      }

      if (
        user.isApproved &&
        (!declinedAt || approveTimestamp > declineTimestamp)
      ) {
        console.log(
          "✅ Approved delivery user, continuing to normal login flow"
        );
      } else {
        // Case 3: User is pending approval (initial state or no recent actions)
        return res.status(200).json({
          message: "Delivery application pending approval",
          deliveryStatus: "pending",
          redirectTo: "/waitingforapproval",
          user: {
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isApproved: false,
          },
        });
      }

      // Case 3: User is approved - continue with normal login flow (will redirect to /deliverydashboard)
      // This falls through to the normal login logic below
    }

    const sessionId = req.sessionId;
    const userId = user._id;

    // Cart merging logic (unchanged)
    const sessionCart = await Cart.findOne({ sessionId });
    let userCart = await Cart.findOne({ userId });

    if (sessionCart && sessionCart.items.length > 0) {
      if (!userCart) {
        userCart = new Cart({
          userId: userId,
          items: sessionCart.items,
        });
        await userCart.save();
        console.log(
          `Created new user cart with ${sessionCart.items.length} items from session`
        );
      } else {
        for (const sessionItem of sessionCart.items) {
          const existingItemIndex = userCart.items.findIndex(
            (item) => item.categoryId === sessionItem.categoryId
          );

          if (existingItemIndex !== -1) {
            const existingItem = userCart.items[existingItemIndex];
            const newQuantity = existingItem.quantity + sessionItem.quantity;

            const validateQuantity = (
              quantity: number,
              measurement_unit: number
            ) => {
              if (measurement_unit === 1) {
                const multiplied = Math.round(quantity * 4);
                return (
                  multiplied >= 1 &&
                  Math.abs(quantity * 4 - multiplied) < 0.0001
                );
              } else {
                return Number.isInteger(quantity) && quantity >= 1;
              }
            };

            if (validateQuantity(newQuantity, existingItem.measurement_unit)) {
              existingItem.quantity = newQuantity;
              // Update other fields from session item if needed
              existingItem.name = sessionItem.name;
              existingItem.image = sessionItem.image;
              existingItem.points = sessionItem.points;
              existingItem.price = sessionItem.price;
              existingItem.categoryName = sessionItem.categoryName;
            } else {
              console.warn(
                `Cannot merge item ${sessionItem.name}: invalid quantity ${newQuantity}`
              );
            }
          } else {
            userCart.items.push({
              // _id:sessionItem._id,
              categoryId: sessionItem.categoryId,
              categoryName: sessionItem.categoryName,
              name: sessionItem.name,
              image: sessionItem.image,
              points: sessionItem.points,
              price: sessionItem.price,
              measurement_unit: sessionItem.measurement_unit,
              quantity: sessionItem.quantity,
            });
          }
        }
        await userCart.save();
        console.log(
          `Merged ${sessionCart.items.length} session items with existing user cart`
        );
      }

      await Cart.deleteOne({ sessionId });
    } else {
      if (userCart) {
        console.log(`User cart preserved with ${userCart.items.length} items`);
      }
    }

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    user.refreshToken = refreshToken;
    await user.save();

    res.clearCookie("sessionId");

    // Determine redirect path based on user role and approval status
    let redirectTo = "/dashboard"; // Default redirect
    if (user.role === "delivery" && user.isApproved) {
      redirectTo = "/deliverydashboard";
    } else if (user.role === "admin") {
      redirectTo = "/admin";
    } else if (user.role === "customer") {
      redirectTo = "/customer";
    }

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
      .json({
        accessToken,
        user,
        deliveryStatus: user.role === "delivery" ? "approved" : undefined,
        redirectTo,
      });
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

// Add this endpoint to your auth controller

export const getDeliveryAttachments = async (req: Request, res: Response) => {
  try {
    const deliveryUsers = await User.find({
      role: "delivery",
    }).select("name email phoneNumber attachments isApproved createdAt");

    if (!deliveryUsers || deliveryUsers.length === 0) {
      return res.status(404).json({
        message: "No delivery users found",
      });
    }

    // ✅ IMPROVED: Better status determination for admin view
    const deliveryAttachments = deliveryUsers.map((user) => {
      const declineReason = user.attachments?.declineReason || null;
      const declinedAt = user.attachments?.declinedAt || null;
      const approvedAt = user.attachments?.approvedAt || null;

      let currentStatus = "pending"; // Default

      const declineTimestamp = declinedAt ? new Date(declinedAt).getTime() : 0;
      const approveTimestamp = approvedAt ? new Date(approvedAt).getTime() : 0;

      if (declineTimestamp > 0 && approveTimestamp > 0) {
        currentStatus =
          declineTimestamp > approveTimestamp ? "declined" : "approved";
      } else if (user.isApproved && approvedAt) {
        currentStatus = "approved";
      } else if (declineReason && declinedAt) {
        currentStatus = "declined";
      }

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isApproved: user.isApproved,
        currentStatus, // This will show the actual current status
        createdAt: user.createdAt,
        attachments: user.attachments,
      };
    });

    res.status(200).json({
      message: "Delivery attachments retrieved successfully",
      count: deliveryAttachments.length,
      data: deliveryAttachments,
    });
  } catch (err) {
    console.error("Error fetching delivery attachments:", err);
    res.status(500).json({
      message: "Failed to fetch delivery attachments",
    });
  }
};
// Fixed approveDeliveryUser function:

export const approveDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const deliveryUser = await User.findById(userId);

    if (!deliveryUser) {
      return res.status(404).json({
        message: "Delivery user not found",
      });
    }

    if (deliveryUser.role !== "delivery") {
      return res.status(400).json({
        message: "User is not a delivery person",
      });
    }

    // ✅ FIXED: Allow re-approval of previously declined users
    // Remove the check for already approved users
    // if (deliveryUser.isApproved) {
    //   return res.status(400).json({
    //     message: "Delivery user is already approved"
    //   });
    // }

    console.log("🔄 Approving user:", {
      userId: deliveryUser._id,
      email: deliveryUser.email,
      currentlyApproved: deliveryUser.isApproved,
      hasDeclineReason: !!deliveryUser.attachments?.declineReason,
    });

    // ✅ FIXED: Always set isApproved to true
    deliveryUser.isApproved = true;

    // ✅ FIXED: Completely remove decline information and add approval timestamp
    if (deliveryUser.attachments) {
      // Remove decline-related fields entirely
      const { declineReason, declinedAt, status, ...cleanAttachments } =
        deliveryUser.attachments;
      deliveryUser.attachments = {
        ...cleanAttachments,
        status: "approved",
        approvedAt: new Date(),
      };
    } else {
      // Create attachments if it doesn't exist
      deliveryUser.attachments = {
        status: "approved",
        approvedAt: new Date(),
      };
    }

    await deliveryUser.save();

    console.log("✅ User approved successfully:", {
      userId: deliveryUser._id,
      isApproved: deliveryUser.isApproved,
      attachments: deliveryUser.attachments,
    });

    res.status(200).json({
      message: "Delivery user approved successfully",
      user: {
        userId: deliveryUser._id,
        name: deliveryUser.name,
        email: deliveryUser.email,
        phoneNumber: deliveryUser.phoneNumber,
        isApproved: deliveryUser.isApproved,
        role: deliveryUser.role,
      },
    });
  } catch (err) {
    console.error("Error approving delivery user:", err);
    res.status(500).json({
      message: "Failed to approve delivery user",
    });
  }
};
export const declineDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const deliveryUser = await User.findById(userId);

    if (!deliveryUser) {
      return res.status(404).json({
        message: "Delivery user not found",
      });
    }

    if (deliveryUser.role !== "delivery") {
      return res.status(400).json({
        message: "User is not a delivery person",
      });
    }

    // Set approval status to false and store decline information
    deliveryUser.isApproved = false;

    // Store decline reason and timestamp
    deliveryUser.attachments = {
      ...deliveryUser.attachments,
      declineReason: reason || "Application declined",
      declinedAt: new Date(),
      status: "declined",
    };

    // Clear any existing refresh tokens to force re-login
    deliveryUser.refreshToken = "";

    await deliveryUser.save();

    res.status(200).json({
      message: "Delivery user declined successfully",
      user: {
        userId: deliveryUser._id,
        name: deliveryUser.name,
        email: deliveryUser.email,
        phoneNumber: deliveryUser.phoneNumber,
        isApproved: deliveryUser.isApproved,
        role: deliveryUser.role,
        declineReason: reason || "Application declined",
        declinedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Error declining delivery user:", err);
    res.status(500).json({
      message: "Failed to decline delivery user",
    });
  }
};
// Update your getDeliveryStatus function in the backend:

export const getDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "delivery") {
      return res.status(400).json({ message: "User is not a delivery person" });
    }

    const declineReason = user.attachments?.declineReason || null;
    const declinedAt = user.attachments?.declinedAt || null;
    const approvedAt = user.attachments?.approvedAt || null;
    const submittedAt = user.attachments?.submittedAt || user.createdAt;

    // ✅ IMPROVED: Better logic for determining status
    let deliveryStatus = "pending"; // Default to pending
    let redirectTo = "/waitingforapproval";

    const declineTimestamp = declinedAt ? new Date(declinedAt).getTime() : 0;
    const approveTimestamp = approvedAt ? new Date(approvedAt).getTime() : 0;

    console.log("🔍 Status check:", {
      userId,
      isApproved: user.isApproved,
      hasDeclineReason: !!declineReason,
      declineTimestamp,
      approveTimestamp,
      mostRecent: declineTimestamp > approveTimestamp ? "declined" : "approved",
    });

    // Determine status based on most recent action
    if (declineTimestamp > 0 && approveTimestamp > 0) {
      // Both actions exist, use the most recent
      if (declineTimestamp > approveTimestamp) {
        deliveryStatus = "declined";
      } else {
        deliveryStatus = "approved";
        redirectTo = "/deliverydashboard";
      }
    } else if (user.isApproved && approvedAt) {
      // Only approved
      deliveryStatus = "approved";
      redirectTo = "/deliverydashboard";
    } else if (declineReason && declinedAt) {
      // Only declined
      deliveryStatus = "declined";
    } else {
      // No actions taken yet - still pending
      deliveryStatus = "pending";
    }

    console.log("📤 Sending status:", deliveryStatus);

    res.status(200).json({
      deliveryStatus,
      redirectTo,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: deliveryStatus === "approved",
        phoneNumber: user.phoneNumber,
      },
      ...(declineReason &&
        deliveryStatus === "declined" && {
          declineReason,
          declinedAt,
          canReapply: true,
        }),
      ...(approvedAt && deliveryStatus === "approved" && { approvedAt }),
      statusHistory: {
        submittedAt,
        ...(declinedAt && { declinedAt }),
        ...(approvedAt && { approvedAt }),
      },
    });
  } catch (err) {
    console.error("Error fetching delivery status:", err);
    res.status(500).json({
      message: "Failed to fetch delivery status",
    });
  }
};
export const checkDeliveryStatusByEmail = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email, role: "delivery" });

    if (!user) {
      return res.status(404).json({ message: "Delivery user not found" });
    }

    const declineReason = user.attachments?.declineReason || null;
    const declinedAt = user.attachments?.declinedAt || null;
    const approvedAt = user.attachments?.approvedAt || null;
    const submittedAt = user.attachments?.submittedAt || user.createdAt;

    // Use same logic as getDeliveryStatus
    let deliveryStatus = "pending";
    let redirectTo = "/waiting-for-approval";

    const declineTimestamp = declinedAt ? new Date(declinedAt).getTime() : 0;
    const approveTimestamp = approvedAt ? new Date(approvedAt).getTime() : 0;

    if (declineTimestamp > 0 && approveTimestamp > 0) {
      if (declineTimestamp > approveTimestamp) {
        deliveryStatus = "declined";
      } else {
        deliveryStatus = "approved";
        redirectTo = "/deliverydashboard";
      }
    } else if (user.isApproved && approvedAt) {
      deliveryStatus = "approved";
      redirectTo = "/deliverydashboard";
    } else if (declineReason && declinedAt) {
      deliveryStatus = "declined";
    }

    res.status(200).json({
      deliveryStatus,
      redirectTo,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: deliveryStatus === "approved",
        phoneNumber: user.phoneNumber,
      },
      ...(declineReason &&
        deliveryStatus === "declined" && {
          declineReason,
          declinedAt,
          canReapply: true,
        }),
      ...(approvedAt && deliveryStatus === "approved" && { approvedAt }),
      statusHistory: {
        submittedAt,
        ...(declinedAt && { declinedAt }),
        ...(approvedAt && { approvedAt }),
      },
    });
  } catch (err) {
    console.error("Error checking delivery status by email:", err);
    res.status(500).json({
      message: "Failed to check delivery status",
    });
  }
};
