import mongoose, { Schema, type Model, type Types } from "mongoose";
import { CHAPTER_SORTS, type ChapterSort } from "@/lib/folders/sort";

export interface FolderFields {
  userId: Types.ObjectId;
  name: string;
  notes: string;
  // Conflict check for folder notes only, so saving a chapter never conflicts with them.
  notesUpdatedAt: Date;
  lastActivityAt: Date;
  // Missing on folders created by older deployments until migration 003 runs again.
  position?: number;
  chapterSort: ChapterSort;
  // Set on the first switch to manual, which takes positions from the order shown until then.
  manualChapterOrder: boolean;
  shareToken?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<FolderFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    notes: { type: String, default: "" },
    notesUpdatedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    position: { type: Number },
    chapterSort: { type: String, enum: CHAPTER_SORTS, default: "created" },
    manualChapterOrder: { type: Boolean, default: false },
    shareToken: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

folderSchema.index(
  { userId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
folderSchema.index({ userId: 1, lastActivityAt: -1 });
folderSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);

export const Folder: Model<FolderFields> =
  (mongoose.models.Folder as Model<FolderFields> | undefined) ??
  mongoose.model<FolderFields>("Folder", folderSchema);
