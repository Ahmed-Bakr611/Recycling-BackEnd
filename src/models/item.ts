import { Schema, model, Types, Document } from "mongoose";
import slugify from "slugify";

export interface IItem {
  _id: Types.ObjectId;
  // name can be a string (legacy) or translations object { en?: string, ar?: string }
  name: any;
  nameObj?: any;
  slug?: string; // Add slug field
  itemSlug?: string;
  // legacy helper: readable item name
  itemName?: string;
  points: number;
  price: number;
  quantity: number;
  measurement_unit: 1 | 2;
  image: string;
  categoryName?: string;
}

export const itemSchema = new Schema<IItem>(
  {
    name: { type: Schema.Types.Mixed, required: true },
    slug: { type: String, required: false }, // optional for backward compatibility
  itemSlug: { type: String, required: false },
  nameObj: { type: Schema.Types.Mixed, required: false },
    points: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    measurement_unit: { type: Number, enum: [1, 2], required: true },
    image: { type: String, required: true },
    categoryName: { type: String },
  },
  { _id: true }
);

// Index slug for faster lookups
itemSchema.index({ slug: 1 });

// Convert legacy string names to translations object and ensure slug
itemSchema.pre('save', function(this: any, next) {
  try {
    if (this.name && typeof this.name === 'string') {
      this.name = { en: this.name };
    }

    if (!this.slug && this.name) {
      const source = typeof this.name === 'string' ? this.name : (this.name.en || Object.values(this.name || {})[0] || this._id);
      this.slug = slugify(String(source), { lower: true, strict: true });
      // keep itemSlug in sync for subdocument compatibility
      this.itemSlug = this.slug;
    }
    // ensure a nameObj exists for backwards compatibility
    if (!this.nameObj && this.name) {
      this.nameObj = (typeof this.name === 'object') ? this.name : { en: this.name };
    }
  } catch (e) {
    // ignore and continue
  }
  next();
});

const Item = model<IItem>("Item", itemSchema);
export default Item;