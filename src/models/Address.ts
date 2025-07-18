import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  city: String,
  area: String,
  street: String,
  building: String,
  floor: String,
  apartment: String,
  landmark: String,
  notes: String
}, { timestamps: true });

export default mongoose.model('Address', AddressSchema);
