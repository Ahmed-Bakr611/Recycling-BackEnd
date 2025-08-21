import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

interface PointsHistoryEntry {
  orderId?: string;
  points: number;
  type: "earned" | "deducted" | "adjusted";
  reason: string;
  timestamp: Date;
}

interface WarningEntry {
  reporterId: string;
  reason: string;
  orderId?: string;
  createdAt: Date;
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
  // Add rating fields to SafeUser interface - only for delivery users
  rating?: number;
  totalReviews?: number;
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

  // Add rating fields for delivery users only
  rating?: number;
  totalReviews?: number;

  // Warnings and blocking fields
  warningsCount?: number;
  isBlocked?: boolean;
  blockedAt?: Date;
  blockReason?: string;
  warnings?: WarningEntry[];

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

    // Warnings / Blocking
    warningsCount: { type: Number, default: 0, min: 0 },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockReason: { type: String },
    warnings: [
      {
        reporterId: { type: String, required: true },
        reason: { type: String, required: true },
        orderId: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Rating fields - only for delivery users
    rating: {
      type: Number,
      default: function (this: IUser) {
        return this.role === "delivery" ? 0 : undefined;
      },
      min: 0,
      max: 5,
      // Only validate if role is delivery
      validate: {
        validator: function (this: IUser, value: number) {
          if (this.role !== "delivery") {
            return value === undefined;
          }
          return true;
        },
        message: "Rating field is only allowed for delivery users",
      },
    },
    totalReviews: {
      type: Number,
      default: function (this: IUser) {
        return this.role === "delivery" ? 0 : undefined;
      },
      min: 0,
      // Only validate if role is delivery
      validate: {
        validator: function (this: IUser, value: number) {
          if (this.role !== "delivery") {
            return value === undefined;
          }
          return true;
        },
        message: "TotalReviews field is only allowed for delivery users",
      },
    },
  },
  { timestamps: true }
);

// Pre-save middleware to handle rating fields based on role
userSchema.pre("save", async function (next) {
  const user = this as IUser;

  // Handle password hashing
  if (user.isModified("password") && user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }

  // Handle rating fields based on role
  if (user.isModified("role")) {
    if (user.role === "delivery") {
      // Initialize rating fields for delivery users if not set
      if (user.rating === undefined) user.rating = 0;
      if (user.totalReviews === undefined) user.totalReviews = 0;
    } else {
      // Remove rating fields for non-delivery users
      user.rating = undefined;
      user.totalReviews = undefined;
    }
  }

  next();
});

// 3. Instance method: return safe user object
userSchema.methods.toSafeObject = function (): SafeUser {
  const safeUser: SafeUser = {
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

  // Only include rating fields for delivery users
  if (this.role === "delivery") {
    safeUser.rating = this.rating;
    safeUser.totalReviews = this.totalReviews;
  }

  return safeUser;
};

// 4. Password compare method
userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password || "");
};

// 5. Static method to create delivery user with rating fields
userSchema.statics.createDeliveryUser = function (userData: Partial<IUser>) {
  return new this({
    ...userData,
    role: "delivery",
    rating: 0,
    totalReviews: 0,
  });
};

// 6. Export model
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
