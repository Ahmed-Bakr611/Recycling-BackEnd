import { Schema, model, Types, Document } from "mongoose";

/**
 * ──────────────
 * Interfaces
 * ──────────────
 */
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
  subcategories: ISubcategory[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ──────────────
 * Subcategory Schema
 * ──────────────
 */
const subCategorySchema = new Schema<ISubcategory>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    points: { type: Number, required: true },
    unit: { type: String, enum: ["قطعة", "كيلو"], required: true },
  },
  { _id: false }
);

/**
 * ──────────────
 * Category Schema
 * ──────────────
 */
const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    subcategories: [subCategorySchema],
  },
  { timestamps: true }
);

/**
 * ──────────────
 * Model
 * ──────────────
 */
const Category = model<ICategory>("Category", categorySchema);
export default Category;
