import mongoose, { Schema, type Model, type Types } from "mongoose";

// blockerId blocks blockedId (D80).
export interface BlockFields {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
}

const blockSchema = new Schema<BlockFields>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export const Block: Model<BlockFields> =
  (mongoose.models.Block as Model<BlockFields> | undefined) ??
  mongoose.model<BlockFields>("Block", blockSchema);
