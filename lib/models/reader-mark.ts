import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  MAX_BOOKMARK_NAME_LENGTH,
  MAX_QUOTE_CONTEXT_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_READER_NOTE_LENGTH,
} from "@/lib/limits";

export const READER_MARK_KINDS = ["bookmark", "note"] as const;
export type ReaderMarkKind = (typeof READER_MARK_KINDS)[number];

// A reader's private bookmark or note in a public chapter (D80, task 74). A bookmark keeps how far
// the page was scrolled; a note keeps the quote with its context and where in the chapter text it
// started (both 0–1), so it can be found again after the author edits the chapter.
export interface ReaderMarkFields {
  userId: Types.ObjectId;
  storyId: Types.ObjectId;
  folderId: Types.ObjectId;
  kind: ReaderMarkKind;
  position: number;
  name?: string;
  text?: string;
  quote?: string;
  prefix?: string;
  suffix?: string;
  createdAt: Date;
  updatedAt: Date;
}

const readerMarkSchema = new Schema<ReaderMarkFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    kind: { type: String, enum: READER_MARK_KINDS, required: true },
    position: { type: Number, min: 0, max: 1, required: true },
    name: { type: String, maxlength: MAX_BOOKMARK_NAME_LENGTH },
    text: { type: String, maxlength: MAX_READER_NOTE_LENGTH },
    quote: { type: String, maxlength: MAX_QUOTE_LENGTH },
    prefix: { type: String, maxlength: MAX_QUOTE_CONTEXT_LENGTH },
    suffix: { type: String, maxlength: MAX_QUOTE_CONTEXT_LENGTH },
  },
  { timestamps: true, versionKey: false },
);

readerMarkSchema.index({ userId: 1, storyId: 1 });
// For the purge of a chapter or a folder (lib/social/cascade.ts).
readerMarkSchema.index({ storyId: 1 });
readerMarkSchema.index({ folderId: 1 });

export const ReaderMark: Model<ReaderMarkFields> =
  (mongoose.models.ReaderMark as Model<ReaderMarkFields> | undefined) ??
  mongoose.model<ReaderMarkFields>(
    "ReaderMark",
    readerMarkSchema,
    "readerMarks",
  );
