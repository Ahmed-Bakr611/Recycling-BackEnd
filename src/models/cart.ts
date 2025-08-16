import mongoose, { Schema, Document, Types } from "mongoose";

// Interface for bilingual text support
export interface IBilingualText {
  en: string;
  ar: string;
}

// Schema for bilingual text
const bilingualTextSchema = new Schema<IBilingualText>({
  en: { type: String, required: true },
  ar: { type: String, required: true }
}, { _id: false });

export interface ICartItem {
  _id?: string;
  categoryId: string;
  categoryName: IBilingualText; // Now bilingual
  name: IBilingualText; // Now bilingual
  image: string;
  points: number;
  price: number;
  measurement_unit: number;
  quantity: number;
}

export interface ICart extends Document {
  userId?: Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  // Helper methods
  getDisplayName(itemIndex: number, language?: 'en' | 'ar'): string;
  getDisplayCategoryName(itemIndex: number, language?: 'en' | 'ar'): string;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    _id: { type: String, required: false },
    categoryId: { type: String, required: true },
    name: {
      type: bilingualTextSchema,
      required: true
    },
    image: { type: String, required: false },
    points: { type: Number, required: true },
    price: { type: Number, required: true },
    categoryName: {
      type: bilingualTextSchema,
      required: true
    },
    measurement_unit: { type: Number, required: true },
    quantity: {
      type: Number,
      required: true,
      min: 0.25,
      validate: {
        validator: function (this: ICartItem, value: number) {
          // For KG items (measurement_unit = 1), allow 0.25 increments
          if (this.measurement_unit === 1) {
            // Check if value is a multiple of 0.25 (0.25, 0.5, 0.75, 1.0, 1.25, etc.)
            // Use Math.round to handle floating point precision issues
            const multiplied = Math.round(value * 4);
            return multiplied >= 1 && Math.abs(value * 4 - multiplied) < 0.0001;
          }
          // For Piece items (measurement_unit = 2), require whole numbers >= 1
          return Number.isInteger(value) && value >= 1;
        },
        message:
          "For KG items, quantity must be in 0.25 increments (0.25, 0.5, 0.75, 1.0, etc.). For Piece items, quantity must be whole numbers >= 1.",
      },
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      unique: true,
      sparse: true,
    },
    sessionId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

// Helper methods for language support
cartSchema.methods.getDisplayName = function(itemIndex: number, language: 'en' | 'ar' = 'en'): string {
  if (!this.items[itemIndex] || !this.items[itemIndex].name) return '';
  return this.items[itemIndex].name[language] || this.items[itemIndex].name.en;
};

cartSchema.methods.getDisplayCategoryName = function(itemIndex: number, language: 'en' | 'ar' = 'en'): string {
  if (!this.items[itemIndex] || !this.items[itemIndex].categoryName) return '';
  return this.items[itemIndex].categoryName[language] || this.items[itemIndex].categoryName.en;
};

// Ensure that either userId or sessionId is present (but not both)
cartSchema.pre("save", function (next) {
  if ((!this.userId && !this.sessionId) || (this.userId && this.sessionId)) {
    return next(
      new Error("Either userId or sessionId must be provided, but not both")
    );
  }
  next();
});

// Create compound index to ensure uniqueness
cartSchema.index(
  { userId: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      $or: [{ userId: { $exists: true } }, { sessionId: { $exists: true } }],
    },
  }
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);
export default Cart;