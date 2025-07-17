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
    quantity: { type: Number, required: true, min: 1 },
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
