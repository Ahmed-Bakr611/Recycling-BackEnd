// models/pickupOrder.ts - Updated with bilingual support and collected status support
import mongoose, { Document, Model, Types } from "mongoose";

// Interface for bilingual text support
export interface IBilingualText {
  en: string;
  ar: string;
}

// Schema for bilingual text
const bilingualTextSchema = new mongoose.Schema<IBilingualText>({
  en: { type: String, required: true },
  ar: { type: String, required: true }
}, { _id: false });

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

// UPDATED: Enhanced ItemSchema with bilingual support and quantity management fields
const ItemSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  image: { type: String, required: true },
  name: {
    type: bilingualTextSchema, // Now bilingual
    required: true,
  },
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }, // This becomes the actual/adjusted quantity
  categoryName: {
    type: bilingualTextSchema, // Now bilingual
    required: false
  },
  
  // Quantity management fields
  originalQuantity: { 
    type: Number, 
    default: null 
  }, // Original quantity before adjustment
  quantityAdjusted: { 
    type: Boolean, 
    default: false 
  }, // Flag indicating if quantity was adjusted
  unit: {
    type: String,
    default: "kg"
  }, // Unit for quantity measurement (kg, pieces, etc.)
});

// Add helper methods to ItemSchema
ItemSchema.methods.getDisplayName = function(language: 'en' | 'ar' = 'en'): string {
  return this.name[language] || this.name.en;
};

ItemSchema.methods.getDisplayCategoryName = function(language: 'en' | 'ar' = 'en'): string {
  if (!this.categoryName) return '';
  return this.categoryName[language] || this.categoryName.en;
};

const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "assigntocourier", "collected", "completed", "cancelled"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    updatedBy: String,
    reason: String,
    notes: String,
  },
  { _id: false }
);

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

// Delivery Review Schema
const DeliveryReviewSchema = new mongoose.Schema(
  {
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
      default: ""
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
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
    enum: ["pending", "assigntocourier", "collected", "completed", "cancelled"],
    default: "pending",
  },
  statusHistory: {
    type: [StatusHistorySchema],
    default: [],
  },
  deliveryProof: {
    type: DeliveryProofSchema,
    default: null,
  },
  
  // Delivery Review field
  deliveryReview: {
    type: DeliveryReviewSchema,
    default: null,
  },
  
  // Collection timestamp (when courier marks as collected)
  collectedAt: {
    type: Date,
    default: null,
  },
  
  // Completion timestamp (when admin marks as completed)
  completedAt: {
    type: Date,
    default: null,
  },
  
  // Estimated weight field (for both customers and buyers)
  estimatedWeight: {
    type: String,
    default: null,
  },
  
  // Quantity adjustment notes (for customer orders only)
  quantityAdjustmentNotes: {
    type: String,
    default: null,
  },
  
  // Flag to indicate if any quantities were adjusted
  hasQuantityAdjustments: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "credit-card"],
    default: null,
  },
  deliveryFee: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    default: 0,
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Helper methods for bilingual support
OrderSchema.methods.getItemDisplayName = function(itemIndex: number, language: 'en' | 'ar' = 'en'): string {
  if (!this.items[itemIndex] || !this.items[itemIndex].name) return '';
  return this.items[itemIndex].name[language] || this.items[itemIndex].name.en;
};

OrderSchema.methods.getItemDisplayCategoryName = function(itemIndex: number, language: 'en' | 'ar' = 'en'): string {
  if (!this.items[itemIndex] || !this.items[itemIndex].categoryName) return '';
  return this.items[itemIndex].categoryName[language] || this.items[itemIndex].categoryName.en;
};

// Pre-save middleware with quantity adjustment detection
OrderSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Set collectedAt when status changes to collected
  if (
    this.isModified("status") &&
    this.status === "collected" &&
    !this.collectedAt
  ) {
    this.collectedAt = new Date();
  }

  // Set completedAt when status changes to completed
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  // Check if any items have quantity adjustments
  if (this.isModified("items")) {
    this.hasQuantityAdjustments = this.items.some((item: any) => item.quantityAdjusted);
  }

  next();
});

// Add indexes for better query performance
OrderSchema.index({ courier: 1, status: 1 });
OrderSchema.index({ "user.userId": 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ hasQuantityAdjustments: 1 });
OrderSchema.index({ collectedAt: -1 });
OrderSchema.index({ "deliveryReview.reviewedAt": -1 });

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

// UPDATED: Enhanced IItem interface with bilingual support and quantity management
export interface IItem {
  _id: Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  image: string;
  name: IBilingualText; // Now bilingual
  measurement_unit: 1 | 2;
  points: number;
  price: number;
  quantity: number; // Actual/adjusted quantity
  categoryName?: IBilingualText; // Now bilingual
  
  // Quantity management fields
  originalQuantity?: number; // Original quantity before adjustment
  quantityAdjusted?: boolean; // Whether quantity was adjusted
  unit?: string; // Unit of measurement
  
  // Helper methods
  getDisplayName?(language?: 'en' | 'ar'): string;
  getDisplayCategoryName?(language?: 'en' | 'ar'): string;
}

export interface IStatusHistory {
  status: "pending" | "assigntocourier" | "collected" | "completed" | "cancelled";
  timestamp: Date;
  updatedBy?: string;
  reason?: string;
  notes?: string;
}

export interface IDeliveryProof {
  photoPath: string;
  photoUrl: string;
  uploadedAt: Date;
  notes?: string;
  completedBy: mongoose.Types.ObjectId;
}

export interface IDeliveryReview {
  stars: number;
  comment: string;
  reviewedAt: Date;
  reviewedBy: mongoose.Types.ObjectId;
}

export interface IOrderUser {
  userId: mongoose.Types.ObjectId;
  phoneNumber?: string;
  userName?: string;
  email?: string;
  image?: string;
  role?: string;
}

// UPDATED: Enhanced IOrder interface with bilingual support and helper methods
export interface IOrder extends Document {
  user: IOrderUser;
  address: IAddress;
  items: IItem[];
  courier?: mongoose.Types.ObjectId;
  status: "pending" | "assigntocourier" | "collected" | "completed" | "cancelled";
  statusHistory: IStatusHistory[];
  deliveryProof?: IDeliveryProof;
  
  // Delivery Review field
  deliveryReview?: IDeliveryReview;
  
  // Timestamp fields
  collectedAt?: Date; // When courier marks as collected
  completedAt?: Date; // When admin marks as completed
  createdAt: Date;
  updatedAt: Date;
  
  // Additional fields for enhanced functionality
  estimatedWeight?: string; // Estimated weight provided by courier
  quantityAdjustmentNotes?: string; // Notes explaining quantity changes
  hasQuantityAdjustments?: boolean; // Quick flag for orders with quantity changes

  paymentMethod?: "cash"| "credit-card"; 
  deliveryFee?: number; 
  totalAmount?: number; 
  
  // Helper methods for bilingual support
  getItemDisplayName?(itemIndex: number, language?: 'en' | 'ar'): string;
  getItemDisplayCategoryName?(itemIndex: number, language?: 'en' | 'ar'): string;
}

// Clear the model cache and recreate it to ensure schema changes are applied
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;