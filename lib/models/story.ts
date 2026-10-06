import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface StoryFields {
  userId: Types.ObjectId;
  title: string;
  content: string;
  notes: string;
  shareToken?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const storySchema = new Schema<StoryFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    notes: { type: String, default: "" },
    shareToken: { type: String },
    // Always stored: a partial index filter cannot express "field does not exist".
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

storySchema.index(
  { userId: 1, title: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
storySchema.index({ userId: 1, updatedAt: -1 });
storySchema.index(
  { shareToken: 1 },
  {
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);

export const Story: Model<StoryFields> =
  (mongoose.models.Story as Model<StoryFields> | undefined) ??
  mongoose.model<StoryFields>("Story", storySchema);
