import { Request, Response } from "express";
import User from "../models/users";
import Otp from "../models/otp";
import { generateToken, generateOtp, sendOtpEmail } from "../utils/helper";

export const createAndSendOtp = async (email: string): Promise<string> => {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await Otp.findOneAndUpdate(
    { email },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  await sendOtpEmail(email, code);
  return code; // for dev display/logging
};
export const sendOtpForSignup = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

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
    const { name, email, password, provider, imgUrl, otpCode } = req.body;

    const otpEntry = await Otp.findOne({ email, code: otpCode });
    if (!otpEntry || otpEntry.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = await User.create({
      name,
      email,
      password,
      provider: provider || "none",
      imgUrl,
    });

    await otpEntry.deleteOne(); // ✅ remove OTP after use

    const token = generateToken(user._id.toString());
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

// ✅ Signup logic
export const signup = async (req: Request, res: Response) => {
  try {
    console.log("1");
    const { name, email, password, provider, imgUrl } = req.body;
    console.log("2");
    const existing = await User.findOne({ email });
    console.log("3");
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }
    console.log("4");

    await createAndSendOtp(email); // ✅ generates & emails 6-digit OTP
    console.log("OTP sent to:", email);
    const user = await User.create({
      name,
      email,
      password,
      provider: provider || "none",
      imgUrl,
    });
    console.log("5");
    const token = generateToken(user._id.toString());
    console.log("6");
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

// ✅ Login logic
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

    const token = generateToken(user._id.toString());
    return res.status(200).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const code = generateOtp(); // e.g. 6-digit random
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await Otp.findOneAndUpdate(
      { email },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    await sendOtpEmail(email, code); // sends OTP to user's email

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};
