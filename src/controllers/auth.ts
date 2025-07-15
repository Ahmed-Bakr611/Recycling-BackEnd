import { Request, Response } from "express";
import User from "../models/users";
import Otp from "../models/otp";
import { generateToken, createAndSendOtp, verifyOtp } from "../utils/helper";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

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
    const { name, email, password, provider, phoneNumber, otpCode } = req.body;

    await verifyOtp(email, otpCode);

    const user = await User.create({
      name,
      email,
      password,
      provider: provider || "none",
      phoneNumber,
    });
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());
    // Optional: Save refreshToken in DB
    user.refreshToken = refreshToken;
    await user.save();

    res
      .status(201)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .header("Authorization", `Bearer ${accessToken}`)
      .json({ accessToken, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Signup failed" });
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

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token in DB (optional but good practice)
    user.refreshToken = refreshToken;
    await user.save();

    // Send access in header and JSON, and refresh in HTTP-only cookie
    res
      .status(200)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

    await createAndSendOtp(email); // ✅ uses helper method

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
    user.refreshToken = ""; // ✅ optional: log out from all devices
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Reset failed" });
  }
};

export const logout = async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.sendStatus(204);

  const user = await User.findOne({ refreshToken: token });
  if (user) {
    user.refreshToken = "";
    await user.save();
  }

  res.clearCookie("refreshToken", { httpOnly: true });
  res.sendStatus(204);
};
