// ✅ Helper: generate JWT token
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
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

  await transporter.sendMail({
    from: `"Recycle App" <${process.env.MAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `
      <div style="font-family:sans-serif;">
        <h2>OTP Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color:#2e6c80;">${code}</h1>
        <p>This code is valid for 10 minutes.</p>
      </div>
    `,
  });
};
