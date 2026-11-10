import mongoose, { Schema, type Model, type Types } from "mongoose";

// A shelf of a reader's library (task 72, D80); at most MAX_SHELVES per account.
export interface ShelfFields {
  userId: Types.ObjectId;
  name: string;
  order: number;
  createdAt: Date;
}

const shelfSchema = new Schema<ShelfFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

shelfSchema.index({ userId: 1, order: 1 });

export const Shelf: Model<ShelfFields> =
  (mongoose.models.Shelf as Model<ShelfFields> | undefined) ??
  mongoose.model<ShelfFields>("Shelf", shelfSchema);
