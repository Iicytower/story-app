import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_TTL_DAYS,
  NOTIFICATION_TYPES,
  type NotificationGroup,
  type NotificationType,
} from "@/lib/social/notifications";

// In-app notifications (D80, task 81). No address is stored: it comes from the type and the ids
// when read, so a renamed or moved text still links right. authorId is the text's owner or the
// community; storyIds are the chapters of a publication or the one chapter of the object.
export interface NotificationFields {
  userId: Types.ObjectId;
  type: NotificationType;
  group: NotificationGroup;
  objectKey: string;
  // The latest ones, at most ACTORS_KEPT.
  actorIds: Types.ObjectId[];
  count: number;
  authorId?: Types.ObjectId;
  folderId?: Types.ObjectId;
  storyIds?: Types.ObjectId[];
  commentId?: Types.ObjectId;
  // A mention in a direct message (task 85).
  conversationId?: Types.ObjectId;
  // A forum post and its thread (task 87).
  threadId?: Types.ObjectId;
  postId?: Types.ObjectId;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    group: {
      type: String,
      enum: Object.keys(NOTIFICATION_GROUPS),
      required: true,
    },
    objectKey: { type: String, required: true },
    actorIds: { type: [Schema.Types.ObjectId], default: [] },
    count: { type: Number, default: 1 },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder" },
    storyIds: { type: [Schema.Types.ObjectId], default: undefined },
    commentId: { type: Schema.Types.ObjectId },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    threadId: { type: Schema.Types.ObjectId, ref: "ForumThread" },
    postId: { type: Schema.Types.ObjectId, ref: "ForumPost" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// The unread count and the grouping lookup.
notificationSchema.index({ userId: 1, readAt: 1, updatedAt: -1 });
// The list and the limit of MAX_NOTIFICATIONS, newest first whether read or not.
notificationSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
notificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60 },
);

// A deleted account leaves the actors of other users' notifications (task 89).
notificationSchema.index({ actorIds: 1 });

export const Notification: Model<NotificationFields> =
  (mongoose.models.Notification as Model<NotificationFields> | undefined) ??
  mongoose.model<NotificationFields>(
    "Notification",
    notificationSchema,
    "notifications",
  );
