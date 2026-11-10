import mongoose, { Schema, type Model, type Types } from "mongoose";

export const ACTIVITY_TYPES = [
  "chapterPublished",
  "forumThread",
  "authorReply",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TTL_DAYS = 90;

// One entry per event of an author, read by followers at query time (D80, task 75). A publication
// of a book keeps every chapter published by it, so hiding one changes the count shown.
export interface ActivityFields {
  actorId: Types.ObjectId;
  type: ActivityType;
  folderId?: Types.ObjectId;
  storyIds?: Types.ObjectId[];
  threadId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityFields>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder" },
    storyIds: {
      type: [Schema.Types.ObjectId],
      ref: "Story",
      default: undefined,
    },
    threadId: { type: Schema.Types.ObjectId },
    commentId: { type: Schema.Types.ObjectId },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

activitySchema.index({ actorId: 1, createdAt: -1, _id: -1 });
activitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ACTIVITY_TTL_DAYS * 24 * 60 * 60 },
);
// For the purge of a chapter or a folder (lib/social/cascade.ts).
activitySchema.index({ folderId: 1 });
activitySchema.index({ storyIds: 1 });

export const Activity: Model<ActivityFields> =
  (mongoose.models.Activity as Model<ActivityFields> | undefined) ??
  mongoose.model<ActivityFields>("Activity", activitySchema, "activity");
