import { Schema, model, Types, Document } from "mongoose";
import slugify from "slugify";
import { IItem, itemSchema } from "./item";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  // name can be string or translations object
  name: any;
  slug?: string; // new optional field
  nameObj?: any;
  description: string;
  image: string;
  items: Types.DocumentArray<IItem>;
  // legacy helper
  itemName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: Schema.Types.Mixed, required: true, unique: true },
    slug: { type: String, unique: true, sparse: true }, // new field
    description: { type: String, required: true },
    image: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);

// Ensure slug exists before saving
categorySchema.pre('save', function(this: any, next) {
  try {
    if (this.name && typeof this.name === 'string') {
      this.name = { en: this.name };
    }

    if (!this.slug && this.name) {
      const source = typeof this.name === 'string' ? this.name : (this.name.en || Object.values(this.name || {})[0] || this._id);
      this.slug = slugify(String(source), { lower: true, strict: true });
    }
  } catch (e) {
    // ignore
  }
  next();
});

const Category = model<ICategory>("Category", categorySchema);
export default Category;
