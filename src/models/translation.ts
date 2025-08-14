import { Schema, model, Document } from 'mongoose';

export interface ITranslation extends Document {
  key: string;
  translations: {
    en: string;
    ar: string;
  };
  type: 'category' | 'item' | 'general';
  referenceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema<ITranslation>({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  translations: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  type: {
    type: String,
    enum: ['category', 'item', 'general'],
    required: true
  },
  referenceId: {
    type: String,
    required: false,
    index: true
  }
}, {
  timestamps: true
});

export default model<ITranslation>('Translation', translationSchema);