import { Schema, model, Types, Document } from "mongoose";

export interface IItem {
  _id: Types.ObjectId;
  name: string;
  slug: string; // Add slug field
  points: number;
  price: number;
  quantity: number;
  measurement_unit: 1 | 2;
  image: string;
  categoryName: string;
}

export const itemSchema = new Schema<IItem>({
  name: { type: String, required: true },
  slug: { type: String, required: false }, // Add slug field (optional for backward compatibility)
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  image: { type: String, required: true },
  categoryName: { type: String },
});

// Optional: Add index for better performance on slug queries
itemSchema.index({ slug: 1 });

// Optional: Pre-save middleware to auto-generate slug if not provided
itemSchema.pre('save', function() {
  if (this.name && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }
});

const Item = model<IItem>("Item", itemSchema);
export default Item;