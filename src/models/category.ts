import { Schema, model, Types, Document } from "mongoose";

export interface ISubcategory {
  _id?: Types.ObjectId;
  name: string;
  image: string;
  points: number;
  unit: "قطعة" | "كيلو";
}

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  image: string; 
  subcategories: ISubcategory[];
  createdAt: Date;
  updatedAt: Date;
}

const subCategorySchema = new Schema<ISubcategory>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    points: { type: Number, required: true },
    unit: { type: String, enum: ["قطعة", "كيلو"], required: true },
  },
  { _id: false }
);

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    image: { type: String, required: true }, 
    subcategories: [subCategorySchema],
  },
  { timestamps: true }
);

const Category = model<ICategory>("Category", categorySchema);
export default Category;
