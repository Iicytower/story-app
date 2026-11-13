import mongoose, { Schema, type Model, type Types } from "mongoose";
import { adultMarkSchema, type AdultMark } from "@/lib/models/adult-mark";
import { CHAPTER_SORTS, type ChapterSort } from "@/lib/folders/sort";
import { FOLDER_LANGUAGES, type FolderLanguage } from "@/lib/languages";

export interface FolderFields {
  userId: Types.ObjectId;
  name: string;
  // Plain text for readers (task 98); missing on folders from before it, which means empty.
  description?: string;
  notes: string;
  // Conflict check for folder notes only, so saving a chapter never conflicts with them.
  notesUpdatedAt: Date;
  lastActivityAt: Date;
  // Missing on folders created by older deployments until migration 003 runs again.
  position?: number;
  // Missing on folders created by older deployments until migration 005 runs again.
  tags?: string[];
  chapterSort: ChapterSort;
  // Set on the first switch to manual, which takes positions from the order shown until then.
  manualChapterOrder: boolean;
  // Missing means not published.
  published?: boolean;
  // Addresses from before a rename; they redirect to the current one.
  formerSlugs?: string[];
  // Last version number handed out; never decreases, so a deleted version's number is not reused.
  versionCounter?: number;
  // Missing means Polish (folderLanguage); only a language the user picked is stored.
  language?: FolderLanguage;
  // Missing means not 18+ (D67).
  adult?: AdultMark;
  // The rated cover shown for the folder (task 26); a pending one only waits in `covers`.
  coverId?: Types.ObjectId;
  // Set when a pending cover was dropped after its last try (D68); the folder page tells why.
  coverRejectedAt?: Date;
  // Covers the book's thread and every chapter; existing comments are hidden, not deleted.
  commentsDisabled?: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<FolderFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    notes: { type: String, default: "" },
    notesUpdatedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    position: { type: Number },
    tags: { type: [String] },
    chapterSort: { type: String, enum: CHAPTER_SORTS, default: "created" },
    manualChapterOrder: { type: Boolean, default: false },
    published: { type: Boolean },
    formerSlugs: { type: [String], default: undefined },
    versionCounter: { type: Number },
    language: { type: String, enum: FOLDER_LANGUAGES },
    adult: { type: adultMarkSchema },
    coverId: { type: Schema.Types.ObjectId, ref: "Cover" },
    coverRejectedAt: { type: Date },
    commentsDisabled: { type: Boolean },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

folderSchema.index(
  { userId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
folderSchema.index({ userId: 1, lastActivityAt: -1 });

export const Folder: Model<FolderFields> =
  (mongoose.models.Folder as Model<FolderFields> | undefined) ??
  mongoose.model<FolderFields>("Folder", folderSchema);
