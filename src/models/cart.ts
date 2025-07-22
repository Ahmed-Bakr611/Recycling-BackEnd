import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICartItem {
  categoryId: string;
  itemName: string;
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
    categoryId: { type: String, required: true },
    itemName: { type: String, required: true },
    image: { type: String, required: false },
    points: { type: Number, required: true },
    price: { type: Number, required: true },
    measurement_unit: { type: Number, required: true },
    quantity: { 
      type: Number, 
      required: true, 
      min: 0.25,
      validate: {
        validator: function(this: ICartItem, value: number) {
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
        message: 'For KG items, quantity must be in 0.25 increments (0.25, 0.5, 0.75, 1.0, etc.). For Piece items, quantity must be whole numbers >= 1.'
      }
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    sessionId: { type: String, sparse: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);
export default Cart;
