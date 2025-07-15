// ✅ Helper: generate JWT token
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Otp from "../models/otp";
dotenv.config();

console.log("kkkkkkkkkkkkkkkkkkkkkkkkk");
console.log(
  process.env.MONGO_URI,
  process.env.JWT_SECRET,
  process.env.MAIL_USER,
  process.env.MAIL_PASS
);

const JWT_SECRET = process.env.JWT_SECRET!;

export const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "1h" });
};
export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // returns string like "682947"
};

export const createAndSendOtp = async (email: string): Promise<string> => {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.findOneAndUpdate(
    { email },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  await sendOtpEmail(email, code);
  return code;
};

export const verifyOtp = async (email: string, code: string): Promise<void> => {
  const otp = await Otp.findOne({ email, code });

  if (!otp || otp.expiresAt < new Date()) {
    throw new Error("Invalid or expired OTP");
  }

  await otp.deleteOne();
};

const transporter = nodemailer.createTransport({
  service: "gmail", // Or use mailtrap for dev: smtp.mailtrap.io
  auth: {
    user: process.env.MAIL_USER, // Your Gmail or Mailtrap username
    pass: process.env.MAIL_PASS, // Your Gmail or Mailtrap password
  },
  tls: {
    rejectUnauthorized: false, // ✅ Accept self-signed certs (for dev only)
  },
});

export const sendOtpEmail = async (to: string, code: string) => {
  console.log("Sending OTP email to:", to);
  console.log("OTP code:", code);
  const emailHtml =`
  <div style="font-family: sans-serif;">
    <h2>OTP Verification</h2>
    <p>Your verification code is:</p>
    <div style="padding: 16px 24px; font-size: 24px; font-weight: bold; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9; color: #2e6c80;">
      ${code}
    </div>
    <p style="margin-top: 16px;">This code is valid for 5 minutes.</p>
    <p style="font-size: 12px; color: #888;">Tip: You can copy this code and paste it in the app.</p>
  </div>
`
  await transporter.sendMail({
    from: `"Recycle App" <${process.env.MAIL_USER}>`, // Sender address
    to,
    subject: "Your OTP Code",
    html:emailHtml,
  });
};
