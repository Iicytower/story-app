import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  REACTION_TARGETS,
  REACTIONS,
  type ReactionKey,
  type ReactionTarget,
} from "@/lib/social/reactions";

// One reaction per user and object (D80, task 77). authorId is the owner of the text or of the
// forum the object is in (null for a global forum). folderId and storyId are the place of a
// chapter or comment, so a purge or a moved chapter finds its reactions without the comments.
export interface ReactionFields {
  userId: Types.ObjectId;
  targetType: ReactionTarget;
  targetId: Types.ObjectId;
  authorId: Types.ObjectId | null;
  folderId: Types.ObjectId | null;
  storyId: Types.ObjectId | null;
  reaction: ReactionKey;
  createdAt: Date;
  // Set with the comment's own while a moderator hides it: the TTL index deletes no reactions
  // along with their comment (task 79).
  purgeAt?: Date;
}

const reactionSchema = new Schema<ReactionFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: REACTION_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", default: null },
    reaction: { type: String, enum: REACTIONS, required: true },
    createdAt: { type: Date, required: true },
    purgeAt: { type: Date },
  },
  { versionKey: false },
);

reactionSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
reactionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// Author statistics (task 83).
reactionSchema.index({ authorId: 1, createdAt: -1 });
reactionSchema.index({ folderId: 1 });
reactionSchema.index({ storyId: 1 });
reactionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const Reaction: Model<ReactionFields> =
  (mongoose.models.Reaction as Model<ReactionFields> | undefined) ??
  mongoose.model<ReactionFields>("Reaction", reactionSchema, "reactions");
