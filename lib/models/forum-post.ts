import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_POST_LENGTH } from "@/lib/limits";

// A post of a forum thread: a flat list with quoting (D80, task 87). A deleted first post with
// other posts after it stays without its text, like a comment with replies.
export interface ForumPostFields {
  threadId: Types.ObjectId;
  userId: Types.ObjectId;
  body: string;
  quotePostId?: Types.ObjectId;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  hidden?: { by: Types.ObjectId; at: Date; reason?: string };
  purgeAt?: Date;
}

const forumPostSchema = new Schema<ForumPostFields>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ForumThread",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, maxlength: MAX_POST_LENGTH, default: "" },
    quotePostId: { type: Schema.Types.ObjectId, ref: "ForumPost" },
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
  {
    collection: "forumPosts",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

forumPostSchema.index({ threadId: 1, createdAt: 1, _id: 1 });
// Account deletion (task 89).
forumPostSchema.index({ userId: 1 });
forumPostSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const ForumPost: Model<ForumPostFields> =
  (mongoose.models.ForumPost as Model<ForumPostFields> | undefined) ??
  mongoose.model<ForumPostFields>("ForumPost", forumPostSchema);
