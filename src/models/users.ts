import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface PointsHistoryEntry {
  orderId?: string;
  points: number;
  type: "earned" | "deducted" | "adjusted";
  reason: string;
  timestamp: Date;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  provider: string;
  role: string;
  isApproved: boolean;
  attachments?: Record<string, any>;
  imgUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastActiveAt?: Date;
  stripeCustomerId?: string;
}

// 1. Interface representing a User document
export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  provider: "google" | "facebook" | "none";
  refreshToken?: string;
  role: "admin" | "customer" | "buyer" | "delivery";
  isApproved: boolean;
  attachments?: Record<string, any>;
  totalPoints: number;
  pointsHistory: PointsHistoryEntry[];
  imgUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastActiveAt?: Date;
  stripeCustomerId?: string;

  comparePassword(candidate: string): Promise<boolean>;
  toSafeObject(): SafeUser;
}

const pointsHistorySchema = new Schema(
  {
    orderId: { type: String },
    points: { type: Number, required: true },
    type: {
      type: String,
      enum: ["earned", "deducted", "adjusted"],
      required: true,
    },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// 2. User schema
const userSchema = new Schema<IUser>(
  {
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsHistory: [pointsHistorySchema],
    stripeCustomerId: { type: String, default: null },
    imgUrl: { type: String },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // optional for OAuth users
    phoneNumber: { type: String, required: true },
    provider: {
      type: String,
      enum: ["google", "facebook", "none"],
      default: "none",
    },
    refreshToken: { type: String },
    role: {
      type: String,
      enum: ["admin", "customer", "buyer", "delivery"],
      default: "customer",
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

// 3. Instance method: return safe user object
userSchema.methods.toSafeObject = function (): SafeUser {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phoneNumber: this.phoneNumber,
    provider: this.provider,
    role: this.role,
    isApproved: this.isApproved,
    attachments: this.attachments,
    imgUrl: this.imgUrl,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastActiveAt: this.lastActiveAt,
    stripeCustomerId: this.stripeCustomerId,
  };
};

// 4. Pre-save: hash password if modified
userSchema.pre("save", async function (next) {
  const user = this as IUser;
  if (user.isModified("password") && user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  next();
});

// 5. Password compare method
userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password || "");
};

// 6. Export model
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
