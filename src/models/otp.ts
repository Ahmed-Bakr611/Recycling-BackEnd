import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOtp extends Document {
  email: string;
  code: string;
  expiresAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true },
    code: { type: String, required: true }, // store as plain or hashed
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const Otp: Model<IOtp> = mongoose.model<IOtp>("Otp", otpSchema);
export default Otp;
