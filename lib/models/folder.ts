import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface FolderFields {
  userId: Types.ObjectId;
  name: string;
  notes: string;
  // Conflict check for folder notes only, so saving a chapter never conflicts with them.
  notesUpdatedAt: Date;
  lastActivityAt: Date;
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
