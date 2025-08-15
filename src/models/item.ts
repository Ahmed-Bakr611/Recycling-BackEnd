import { Schema, model, Types, Document } from "mongoose";

export interface IItem {
  _id: Types.ObjectId;
  name: string;
  points: number;
  price: number;
  quantity: number; // <-- Added here
  measurement_unit: 1 | 2;
  image: string;
  categoryName: string;
}

export const itemSchema = new Schema<IItem>({
  name: { type: String, required: true },
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }, // <-- Added here
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  image: { type: String, required: true },
  categoryName: { type: String },
});

const Item = model<IItem>("Item", itemSchema);
export default Item;