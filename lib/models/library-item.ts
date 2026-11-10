import mongoose, { Schema, type Model, type Types } from "mongoose";

// A book (folder) saved in a reader's library, on any number of their shelves, also none (D80).
export interface LibraryItemFields {
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  shelfIds: Types.ObjectId[];
  addedAt: Date;
}

const libraryItemSchema = new Schema<LibraryItemFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    shelfIds: { type: [Schema.Types.ObjectId], ref: "Shelf", default: [] },
    addedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

libraryItemSchema.index({ userId: 1, folderId: 1 }, { unique: true });
libraryItemSchema.index({ userId: 1, addedAt: -1, _id: -1 });
libraryItemSchema.index({ folderId: 1 });

export const LibraryItem: Model<LibraryItemFields> =
  (mongoose.models.LibraryItem as Model<LibraryItemFields> | undefined) ??
  mongoose.model<LibraryItemFields>(
    "LibraryItem",
    libraryItemSchema,
    "libraryItems",
  );
