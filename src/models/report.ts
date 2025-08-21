import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  reportedUserId: mongoose.Types.ObjectId;
  reason: string;
  orderId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reportSchema.index(
  { reporterId: 1, reportedUserId: 1, orderId: 1 },
  { unique: true, sparse: true }
);

const Report: Model<IReport> = mongoose.model<IReport>("Report", reportSchema);
export default Report;


