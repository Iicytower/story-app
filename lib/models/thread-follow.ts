import mongoose, { Schema, type Model, type Types } from "mongoose";

// A followed forum thread: a new post in it notifies the follower (D80, task 87).
export interface ThreadFollowFields {
  userId: Types.ObjectId;
  threadId: Types.ObjectId;
  createdAt: Date;
}

const threadFollowSchema = new Schema<ThreadFollowFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ForumThread",
      required: true,
    },
  },
  {
    collection: "threadFollows",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

threadFollowSchema.index({ userId: 1, threadId: 1 }, { unique: true });
threadFollowSchema.index({ threadId: 1 });

export const ThreadFollow: Model<ThreadFollowFields> =
  (mongoose.models.ThreadFollow as Model<ThreadFollowFields> | undefined) ??
  mongoose.model<ThreadFollowFields>("ThreadFollow", threadFollowSchema);
