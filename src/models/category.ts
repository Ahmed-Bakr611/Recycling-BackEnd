import { Schema, model, Types, Document } from "mongoose";
import { IItem, itemSchema } from "./item";

// Interface for bilingual text support
export interface IBilingualText {
  en: string;
  ar: string;
}

// Updated interface to handle bilingual names and descriptions
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: IBilingualText; // Always bilingual object
  description: IBilingualText; // Always bilingual object
  image: string;
  items: Types.DocumentArray<IItem>;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for bilingual text
const bilingualTextSchema = new Schema<IBilingualText>({
  en: { type: String, required: true },
  ar: { type: String, required: true }
}, { _id: false }); // _id: false to prevent MongoDB from creating _id for subdocuments

const categorySchema = new Schema<ICategory>(
  {
    name: { 
      type: bilingualTextSchema, 
      required: true,
      // Create unique compound index on both en and ar fields
      index: true
    },
    description: { 
      type: bilingualTextSchema, 
      required: true 
    },
    image: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);

// Create compound unique index to ensure categories are unique by English name
categorySchema.index({ "name.en": 1 }, { unique: true });

// Add a method to get display name based on language
categorySchema.methods.getDisplayName = function(language: 'en' | 'ar' = 'en'): string {
  return this.name[language] || this.name.en;
};

// Add a method to get display description based on language
categorySchema.methods.getDisplayDescription = function(language: 'en' | 'ar' = 'en'): string {
  return this.description[language] || this.description.en;
};

const Category = model<ICategory>("Category", categorySchema);
export default Category;