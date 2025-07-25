import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISubscriber extends Document {
  email: string;
  name?: string;
  subscribedAt: Date;
}

const SubscriberSchema = new Schema<ISubscriber>({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  subscribedAt: { type: Date, default: Date.now },
});

const Subscriber: Model<ISubscriber> = mongoose.models.Subscriber || mongoose.model<ISubscriber>("Subscriber", SubscriberSchema);

export default Subscriber;
