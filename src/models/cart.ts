import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICartItem {
    categoryName: string;
    quantity: number;
}

export interface ICart extends Document {
    userId?: Types.ObjectId;
    sessionId?: string;
    items: ICartItem[];
}

const cartItemSchema = new Schema<ICartItem>(
    {
        categoryName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 }
    },
    { _id: false }
);

const cartSchema = new Schema<ICart>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
        sessionId: { type: String, sparse: true },
        items: [cartItemSchema]
    },
    { timestamps: true }
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);
export default Cart;
