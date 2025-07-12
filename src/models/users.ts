import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// 1. Interface representing a User document
export interface IUser extends Document {
  imgUrl?: string;
  name: string;
  email: string;
  password?: string;
  provider: "google" | "facebook" | "none";
  comparePassword(candidate: string): Promise<boolean>;
}

// 2. Create schema
const userSchema = new Schema<IUser>(
  {
    imgUrl: { type: String },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // optional for OAuth users
    provider: {
      type: String,
      enum: ["google", "facebook", "none"],
      default: "none",
    },
  },
  { timestamps: true }
);

// 3. Pre-save hook: hash password if modified
userSchema.pre("save", async function (next) {
  const user = this as IUser;
  if (user.isModified("password") && user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  next();
});

// 4. Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password || "");
};

// 5. Export model
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
