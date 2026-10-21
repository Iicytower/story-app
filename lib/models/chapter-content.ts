import mongoose, { Schema, type Model, type Types } from "mongoose";

// One document per chapter state, shared by every version that saw it unchanged.
// _id is the hash of the state (contentHash), so saving the same state again reuses it.
export interface ChapterContentFields {
  _id: string;
  userId: Types.ObjectId;
  storyId: Types.ObjectId;
  title: string;
  content: string;
  notes: string;
  // Set on every save that points to it; deleting a version spares contents used since it started.
  usedAt: Date;
}

const chapterContentSchema = new Schema<ChapterContentFields>(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    notes: { type: String, default: "" },
    usedAt: { type: Date, required: true },
  },
  { collection: "chapterContents" },
);

export const ChapterContent: Model<ChapterContentFields> =
  (mongoose.models.ChapterContent as Model<ChapterContentFields> | undefined) ??
  mongoose.model<ChapterContentFields>("ChapterContent", chapterContentSchema);
