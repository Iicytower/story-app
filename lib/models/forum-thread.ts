import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_THREAD_TITLE_LENGTH } from "@/lib/limits";

// Kept for 30 days after a moderator hides it, like a comment (D80).
export const HIDDEN_FORUM_TTL_DAYS = 30;

// A thread of a global category or of an author's forum (D80, task 87). userId is who started it;
// its first post is the thread's text.
export interface ForumThreadFields {
  scope: "global" | "author";
  categoryId?: string;
  authorId?: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  createdAt: Date;
  lastPostAt: Date;
  postCount: number;
  hidden?: { by: Types.ObjectId; at: Date; reason?: string };
  purgeAt?: Date;
  deletedAt?: Date;
}

const forumThreadSchema = new Schema<ForumThreadFields>(
  {
    scope: { type: String, enum: ["global", "author"], required: true },
    categoryId: { type: String },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: MAX_THREAD_TITLE_LENGTH },
    lastPostAt: { type: Date, required: true },
    postCount: { type: Number, default: 0 },
    hidden: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
          reason: { type: String },
        },
        { _id: false },
      ),
      default: undefined,
    },
    purgeAt: { type: Date },
    deletedAt: { type: Date },
  },
  {
    collection: "forumThreads",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

forumThreadSchema.index({ categoryId: 1, lastPostAt: -1, _id: -1 });
forumThreadSchema.index({ authorId: 1, lastPostAt: -1, _id: -1 });
// Account deletion (task 89).
forumThreadSchema.index({ userId: 1 });
forumThreadSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const ForumThread: Model<ForumThreadFields> =
  (mongoose.models.ForumThread as Model<ForumThreadFields> | undefined) ??
  mongoose.model<ForumThreadFields>("ForumThread", forumThreadSchema);
