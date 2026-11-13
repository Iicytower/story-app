import mongoose, { Schema, type Model, type Types } from "mongoose";

// A direct conversation of two accounts, kept without a time limit (D80, task 85).
export interface ConversationFields {
  // Both parties, sorted.
  participantIds: Types.ObjectId[];
  // "<smaller id>:<larger id>": one conversation per pair.
  pairKey: string;
  // The creation time until the first message.
  lastMessageAt: Date;
  // The party with a message not read yet: a message leaves only the other one there, so
  // answering reads the conversation too.
  unreadBy: Types.ObjectId[];
  // Set when a block closes the conversation (task 86); a block is also checked when read.
  closedAt: Date | null;
  createdAt: Date;
}

const conversationSchema = new Schema<ConversationFields>(
  {
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
    },
    pairKey: { type: String, required: true },
    lastMessageAt: { type: Date, required: true },
    unreadBy: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

conversationSchema.index({ pairKey: 1 }, { unique: true });
conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });
// The sidebar counter.
conversationSchema.index({ unreadBy: 1 });

export const Conversation: Model<ConversationFields> =
  (mongoose.models.Conversation as Model<ConversationFields> | undefined) ??
  mongoose.model<ConversationFields>("Conversation", conversationSchema);
