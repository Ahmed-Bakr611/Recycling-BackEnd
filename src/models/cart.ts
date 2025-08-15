import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICartItem {
  _id?: string;
  categoryId: string;
  categoryName: string;
  name: any; // string or translations object
  nameObj?: any;
  itemSlug?: string;
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
}

const cartItemSchema = new Schema<ICartItem>(
  {
    _id: { type: String, required: false },
    categoryId: { type: String, required: true },
  name: { type: Schema.Types.Mixed, required: true },
  nameObj: { type: Schema.Types.Mixed, required: false },
  itemSlug: { type: String, required: false },
    image: { type: String, required: false },
    points: { type: Number, required: true },
    price: { type: Number, required: true },
    categoryName: { type: String, required: true },
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
