import { Schema, model, Types, Document } from "mongoose";

export interface IItem extends Document {
  _id: Types.ObjectId;
  name: string;
  points: number;
  price: number;
  quantity: number;
  measurement_unit: 1 | 2;
  image: string;
  categoryId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true },
    points: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    measurement_unit: { type: Number, enum: [1, 2], required: true },
    image: { type: String, required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  },
  { timestamps: true } // ✅ enable timestamps
);

// const items = await Item.find().populate("categoryId");
// const items = await Item.find({ categoryId: someCategoryId });

const Item = model<IItem>("Item", itemSchema);
export default Item;
