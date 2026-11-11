import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_DM_LENGTH } from "@/lib/limits";

// One direct message (D80, task 85), kept without a time limit.
export interface MessageFields {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageFields>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxLength: MAX_DM_LENGTH },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Pages and the poll go by createdAt, ties by _id.
messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });

export const Message: Model<MessageFields> =
  (mongoose.models.Message as Model<MessageFields> | undefined) ??
  mongoose.model<MessageFields>("Message", messageSchema);
