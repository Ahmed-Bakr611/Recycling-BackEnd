import { Schema, model, Types, Document } from "mongoose";

// Interface for bilingual text support
export interface IBilingualText {
  en: string;
  ar: string;
}

export interface IItem {
  _id: Types.ObjectId;
  name: IBilingualText; // Now bilingual
  points: number;
  price: number;
  quantity: number;
  measurement_unit: 1 | 2;
  image: string;
  categoryName: string;
}

// Schema for bilingual text (reused from category)
const bilingualTextSchema = new Schema<IBilingualText>({
  en: { type: String, required: true },
  ar: { type: String, required: true }
}, { _id: false });

export const itemSchema = new Schema<IItem>({
  name: { 
    type: bilingualTextSchema, 
    required: true 
  },
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  image: { type: String, required: true },
  categoryName: { type: String },
});

// Add method to get display name based on language
itemSchema.methods.getDisplayName = function(language: 'en' | 'ar' = 'en'): string {
  return this.name[language] || this.name.en;
};

const Item = model<IItem>("Item", itemSchema);
export default Item;