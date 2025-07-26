import mongoose, { Document, Schema } from 'mongoose';

export interface IDriver extends Document {
  name: string;
  phone: string;
  email: string;
  licenseNumber: string;
  vehicleInfo: {
    type: string;
    model?: string;
    plateNumber?: string;
    color?: string;
  };
  status: 'available' | 'assigned' | 'busy' | 'inactive';
  isActive: boolean;
  rating: number;
  currentLocation?: {
    type: string;
    coordinates: number[];
  };
  currentOrderId?: mongoose.Types.ObjectId;
}

const driverSchema = new Schema<IDriver>({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  licenseNumber: { type: String, required: true, unique: true },
  vehicleInfo: {
    type: { type: String, required: true },
    model: String,
    plateNumber: String,
    color: String
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'busy', 'inactive'],
    default: 'available'
  },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  currentOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }
}, {
  timestamps: true
});

export default mongoose.model<IDriver>('Driver', driverSchema); 