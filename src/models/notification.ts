import mongoose, { Document, Model } from 'mongoose';

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  body: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['order_status', 'order_assigned', 'order_cancelled', 'order_completed', 'system'],
    default: 'order_status' 
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order',
    default: null 
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add indexes for better query performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

// TypeScript interface
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: 'order_status' | 'order_assigned' | 'order_cancelled' | 'order_completed' | 'system';
  orderId?: mongoose.Types.ObjectId;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

// Clear the model cache and recreate it to ensure schema changes are applied
if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
