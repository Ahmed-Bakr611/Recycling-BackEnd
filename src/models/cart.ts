import mongoose, { Schema, Document, Types } from "mongoose";

//Shape of one item inside the cart
export interface CartItem {
    categoryName: string,
    quantity: number
}

//Cart structure
export interface ICart extends Document {
    userId?: Types.ObjectId,
    sessionId: string,
    items: CartItem[]
}

//Mongoose Schema
const cartSchema = new Schema<ICart>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, unique: true, sparse: true},
    sessionId: { type: String, required: false, unique: true, sparse: true },
    items: [
        {
            categoryName: { type: String, required: true },
            quantity: { type: Number, default: 1 },
        }
    ]
});


//registers the schema as a model named "Cart" that can be used to interact with the carts collection in MongoDB.
export default mongoose.model<ICart>('Cart', cartSchema);
