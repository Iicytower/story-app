import mongoose, { Schema, type Model } from "mongoose";

export interface UserFields {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<UserFields>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User: Model<UserFields> =
  (mongoose.models.User as Model<UserFields> | undefined) ??
  mongoose.model<UserFields>("User", userSchema);
