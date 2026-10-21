import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface VersionChapter {
  storyId: Types.ObjectId;
  title: string;
  // Index in the order the folder showed when the version was saved.
  position: number;
  contentId: string;
}

export interface FolderVersionFields {
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  number: number;
  name: string;
  folderNotes: string;
  chapters: VersionChapter[];
  createdAt: Date;
}

const folderVersionSchema = new Schema<FolderVersionFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    number: { type: Number, required: true },
    name: { type: String, required: true },
    folderNotes: { type: String, default: "" },
    chapters: [
      {
        _id: false,
        storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
        title: { type: String, required: true },
        position: { type: Number, required: true },
        contentId: { type: String, ref: "ChapterContent", required: true },
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "folderVersions",
  },
);

folderVersionSchema.index({ folderId: 1, number: 1 }, { unique: true });
// Deleting a version removes the contents no other version points to.
folderVersionSchema.index({ "chapters.contentId": 1 });

export const FolderVersion: Model<FolderVersionFields> =
  (mongoose.models.FolderVersion as Model<FolderVersionFields> | undefined) ??
  mongoose.model<FolderVersionFields>("FolderVersion", folderVersionSchema);
