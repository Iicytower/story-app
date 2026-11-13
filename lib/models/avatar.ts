import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { CoverScores } from "./cover";

// Avatars (task 70, D80): only the classifier's re-encoded 256x256 WebP, never the upload.
// Outside the migration backups, like covers.
export interface AvatarFields {
  userId: Types.ObjectId;
  data: Buffer;
  size: number;
  scores: CoverScores;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

const avatarSchema = new Schema<AvatarFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    scores: {
      type: new Schema<CoverScores>(
        { nsfl: Number, nsfw: Number, sfw: Number },
        { _id: false },
      ),
      required: true,
    },
    model: { type: String, required: true },
  },
  { timestamps: true },
);

avatarSchema.index({ userId: 1 });

export const Avatar: Model<AvatarFields> =
  (mongoose.models.Avatar as Model<AvatarFields> | undefined) ??
  mongoose.model<AvatarFields>("Avatar", avatarSchema);
