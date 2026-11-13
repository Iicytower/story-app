import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_COMMENT_LENGTH } from "@/lib/limits";

// Kept for 30 days after a moderator hides it (D80, task 79).
export const HIDDEN_COMMENT_TTL_DAYS = 30;

// A comment under a public chapter, or under a book's contents when storyId is null (D80,
// task 76). Replies have the top-level comment as parentId: one level only. authorId is the
// owner of the text, userId the writer.
export interface CommentFields {
  authorId: Types.ObjectId;
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  storyId: Types.ObjectId | null;
  parentId: Types.ObjectId | null;
  body: string;
  createdAt: Date;
  editedAt?: Date;
  // A deleted comment with replies stays, without its text, as "comment deleted".
  deletedAt?: Date;
  hidden?: { by: Types.ObjectId; at: Date; reason?: string };
  purgeAt?: Date;
}

const commentSchema = new Schema<CommentFields>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    body: { type: String, maxlength: MAX_COMMENT_LENGTH, default: "" },
    editedAt: { type: Date },
    deletedAt: { type: Date },
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
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

commentSchema.index({ storyId: 1, createdAt: -1 });
commentSchema.index({ folderId: 1, storyId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, createdAt: 1 });
// Ban filters (task 89) and the moderation panel (task 83).
commentSchema.index({ userId: 1 });
commentSchema.index({ authorId: 1, createdAt: -1 });
commentSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
// Replies whose top-level comment is gone (task 79), per chapter and per book's contents.
commentSchema.index({ storyId: 1, parentId: 1 });
commentSchema.index({ folderId: 1, storyId: 1, parentId: 1 });
// The moderation panel's hidden content, newest first.
commentSchema.index(
  { authorId: 1, "hidden.at": -1 },
  { partialFilterExpression: { hidden: { $exists: true } } },
);

export const Comment: Model<CommentFields> =
  (mongoose.models.Comment as Model<CommentFields> | undefined) ??
  mongoose.model<CommentFields>("Comment", commentSchema, "comments");
