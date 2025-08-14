import { Schema, model, Types, Document } from "mongoose";
import { IItem, itemSchema } from "./item";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string; // new field
  description: string;
  image: string;
  items: Types.DocumentArray<IItem>;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, lowercase: true },
    slug: { type: String, unique: true }, // new field
    description: { type: String, required: true },
    image: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);

// Auto-generate slug from name
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .replace(/--+/g, "-");
  }
  next();
});

const Category = model<ICategory>("Category", categorySchema);
export default Category;
