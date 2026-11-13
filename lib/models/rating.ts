import mongoose, { Schema, type Model, type Types } from "mongoose";
import { RATING_TARGETS, type RatingTarget } from "@/lib/social/ratings";

// One rating per user and chapter or book (D80, task 78). folderId is the book of a chapter
// rating too and storyId is null for a book's, so a purge or a moved chapter finds them.
export interface RatingFields {
  userId: Types.ObjectId;
  targetType: RatingTarget;
  targetId: Types.ObjectId;
  authorId: Types.ObjectId;
  folderId: Types.ObjectId;
  storyId: Types.ObjectId | null;
  value: number;
  updatedAt: Date;
}

const ratingSchema = new Schema<RatingFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: RATING_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },
    value: { type: Number, min: 1, max: 5, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

ratingSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
ratingSchema.index({ targetType: 1, targetId: 1 });
// Author statistics (task 83).
ratingSchema.index({ authorId: 1, updatedAt: -1 });
ratingSchema.index({ folderId: 1 });
ratingSchema.index({ storyId: 1 });

export const Rating: Model<RatingFields> =
  (mongoose.models.Rating as Model<RatingFields> | undefined) ??
  mongoose.model<RatingFields>("Rating", ratingSchema, "ratings");
