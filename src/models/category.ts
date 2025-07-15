import { Schema, model, Types, Document } from "mongoose";


export interface IItem {
  _id?: Types.ObjectId;
  name: string;
  points: number;
  price: number;
  measurement_unit: 1 | 2;
  image: string;
}

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  image: string;
  items: IItem[];
  createdAt: Date;
  updatedAt: Date;
}


const itemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true },
    points: { type: Number, required: true },
    price: { type: Number, required: true 
    measurement_unit: { type: Number, enum: [1,2], required: true },
    image: { type: String, required: true },
  },
  { _id: false }
);

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);


const Category = model<ICategory>("Category", categorySchema);
export default Category;
