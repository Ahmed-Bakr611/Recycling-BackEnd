import { Schema, model, Types, Document } from "mongoose";

export interface ISession extends Document {
  userId?: Types.ObjectId; // null for guest
  sessionId: string;
  device: string;
  ipAddress?: string;
  userAgent?: string;
  refreshToken?: string;
  isValid: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const sessionSchema = new Schema<ISession>({
  userId: { type: Types.ObjectId, ref: "User", default: null },
  sessionId: { type: String, required: true, unique: true },
  device: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  refreshToken: { type: String }, // hashed
  isValid: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

export default model<ISession>("Session", sessionSchema);
