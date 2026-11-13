import mongoose, { Schema, type Model, type Types } from "mongoose";

export const MODERATION_ACTIONS = [
  "hide",
  "restore",
  "ban",
  "unban",
  "invite",
  "accept",
  "decline",
  "resign",
  "remove",
  "resolve",
  "dismiss",
  // The admin's own steps (task 88).
  "markAdult",
  "unmarkAdult",
  "clearAdult",
  "save",
  "delete",
  "addModerator",
  "removeModerator",
  "move",
] as const;

export const LOG_TARGET_TYPES = [
  "comment",
  "post",
  "thread",
  "user",
  "report",
  "folder",
  "story",
  "cover",
  "category",
  "tag",
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

// Every moderation step in an author's community, or of the whole site with scope "global"
// (D80, task 79; the admin's in task 88). Entries outlive the accounts they name (task 89).
// Forum categories and predefined tags have string keys, kept in targetKey instead of targetId.
export interface ModerationLogFields {
  authorId: Types.ObjectId | null;
  scope?: "global";
  actorId: Types.ObjectId;
  action: ModerationAction;
  targetType: (typeof LOG_TARGET_TYPES)[number];
  targetId?: Types.ObjectId;
  targetKey?: string;
  targetUserId?: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const moderationLogSchema = new Schema<ModerationLogFields>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    scope: { type: String, enum: ["global"] },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: MODERATION_ACTIONS, required: true },
    targetType: { type: String, enum: LOG_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId },
    targetKey: { type: String },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String },
  },
  {
    collection: "moderationLog",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

moderationLogSchema.index({ authorId: 1, createdAt: -1, _id: -1 });
// The admin's log of every community and the whole site (task 88).
moderationLogSchema.index({ createdAt: -1, _id: -1 });

export const ModerationLog: Model<ModerationLogFields> =
  (mongoose.models.ModerationLog as Model<ModerationLogFields> | undefined) ??
  mongoose.model<ModerationLogFields>("ModerationLog", moderationLogSchema);
