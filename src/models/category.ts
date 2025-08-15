import { Schema, model, Types, Document } from "mongoose";
import { IItem, itemSchema } from "./item";

// Updated interface to handle both string and object name formats
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string | { en: string; ar?: string }; // Union type to handle both formats
  description: string;
  image: string;
  items: Types.DocumentArray<IItem>;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { 
      type: Schema.Types.Mixed, // Changed to Mixed to allow both string and object
      required: true, 
      unique: true 
    },
    description: { type: String, required: true },
    image: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);

const Category = model<ICategory>("Category", categorySchema);
export default Category;