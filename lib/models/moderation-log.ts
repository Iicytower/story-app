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
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

// Every moderation step in an author's community, or of the whole site with scope "global"
// (D80, task 79; the admin's in task 86). Entries outlive the accounts they name (task 89).
export interface ModerationLogFields {
  authorId: Types.ObjectId | null;
  scope?: "global";
  actorId: Types.ObjectId;
  action: ModerationAction;
  targetType: "comment" | "user";
  targetId: Types.ObjectId;
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
    targetType: { type: String, enum: ["comment", "user"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String },
  },
  {
    collection: "moderationLog",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

moderationLogSchema.index({ authorId: 1, createdAt: -1 });

export const ModerationLog: Model<ModerationLogFields> =
  (mongoose.models.ModerationLog as Model<ModerationLogFields> | undefined) ??
  mongoose.model<ModerationLogFields>("ModerationLog", moderationLogSchema);
