import mongoose, { Schema, type Model, type Types } from "mongoose";

// Where a reader is in a book (D80): the last opened chapter, how far it is scrolled (0–1) and
// the chapters scrolled to the end. The purge of a chapter unsets lastStoryId and position.
export interface ReadingProgressFields {
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  lastStoryId?: Types.ObjectId;
  position?: number;
  readStoryIds: Types.ObjectId[];
  updatedAt: Date;
}

const readingProgressSchema = new Schema<ReadingProgressFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    lastStoryId: { type: Schema.Types.ObjectId, ref: "Story" },
    position: { type: Number, min: 0, max: 1 },
    readStoryIds: { type: [Schema.Types.ObjectId], ref: "Story", default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

readingProgressSchema.index({ userId: 1, folderId: 1 }, { unique: true });
readingProgressSchema.index({ folderId: 1 });
readingProgressSchema.index({ lastStoryId: 1 });
readingProgressSchema.index({ readStoryIds: 1 });

export const ReadingProgress: Model<ReadingProgressFields> =
  (mongoose.models.ReadingProgress as
    Model<ReadingProgressFields> | undefined) ??
  mongoose.model<ReadingProgressFields>(
    "ReadingProgress",
    readingProgressSchema,
    "readingProgress",
  );
