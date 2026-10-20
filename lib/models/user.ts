import mongoose, { Schema, type Model } from "mongoose";
import { FOLDER_SORTS, type FolderSort } from "@/lib/folders/sort";

export interface UserFields {
  email: string;
  passwordHash: string;
  folderSort: FolderSort;
  // Set on the first switch to manual, which takes positions from the order shown until then.
  manualFolderOrder: boolean;
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
    folderSort: { type: String, enum: FOLDER_SORTS, default: "updated" },
    manualFolderOrder: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User: Model<UserFields> =
  (mongoose.models.User as Model<UserFields> | undefined) ??
  mongoose.model<UserFields>("User", userSchema);
