// models/pickupOrder.ts
import mongoose, { Document, Model } from "mongoose";

const AddressSchema = new mongoose.Schema({
  city: { type: String, required: true },
  area: String,
  street: String,
  building: String,
  floor: String,
  apartment: String,
  landmark: String,
  isDefault: { type: Boolean, default: false },
});

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addresses: [AddressSchema],
    phoneNumber: { type: String, required: true },
    userName: { type: String, required: true },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  image: { type: String, required: true },
  itemName: { type: String, required: true },
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  categoryName: String,
});

const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "assigntocourier", "completed", "cancelled"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    updatedBy: String,
    reason: String,
    notes: String,
  },
  { _id: false }
);

// NEW: Delivery Proof Schema
const DeliveryProofSchema = new mongoose.Schema(
  {
    photoPath: {
      type: String,
      required: true,
    },
    photoUrl: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    notes: String,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema({
  user: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phoneNumber: String,
    userName: String,
    email: String,
  },
  address: AddressSchema,
  items: [ItemSchema],
  courier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "assigntocourier", "completed", "cancelled"],
    default: "pending",
  },
  statusHistory: {
    type: [StatusHistorySchema],
    default: [],
  },
  // NEW: Delivery proof field
  deliveryProof: {
    type: DeliveryProofSchema,
    default: null,
  },
  // NEW: Completion timestamp
  completedAt: {
    type: Date,
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add pre-save middleware to update the updatedAt field
OrderSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Set completedAt when status changes to completed
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  next();
});

// Add indexes for better query performance
OrderSchema.index({ courier: 1, status: 1 });
OrderSchema.index({ "user.userId": 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

// Define TypeScript interfaces
export interface IAddress {
  city: string;
  area?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface IItem {
  _id?: mongoose.Types.ObjectId; // optional to support pre-insertion or flexibility
  categoryId: mongoose.Types.ObjectId;
  image: string;
  itemName: string;
  measurement_unit: 1 | 2;
  points: number;
  price: number;
  quantity: number;
  categoryName?: string;
}

export interface IStatusHistory {
  status: "pending" | "assigntocourier" | "completed" | "cancelled";
  timestamp: Date;
  updatedBy?: string;
  reason?: string;
  notes?: string;
}

// NEW: Delivery Proof interface
export interface IDeliveryProof {
  photoPath: string;
  photoUrl: string;
  uploadedAt: Date;
  notes?: string;
  completedBy: mongoose.Types.ObjectId;
}

export interface IOrderUser {
  userId: mongoose.Types.ObjectId;
  phoneNumber?: string;
  userName?: string;
  email?: string;
  image?: string;
}

export interface IOrder extends Document {
  user: IOrderUser;
  address: IAddress;
  items: IItem[];
  courier?: mongoose.Types.ObjectId;
  status: "pending" | "assigntocourier" | "completed" | "cancelled";
  statusHistory: IStatusHistory[];
  deliveryProof?: IDeliveryProof; // NEW
  completedAt?: Date; // NEW
  createdAt: Date;
  updatedAt: Date;
}

// Clear the model cache and recreate it to ensure schema changes are applied
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
