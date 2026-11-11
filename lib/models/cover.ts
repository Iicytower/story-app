import mongoose, { Schema, type Model, type Types } from "mongoose";

export type CoverState = "pending" | "rated";

export interface CoverScores {
  nsfl: number;
  nsfw: number;
  sfw: number;
}

// Folder covers (task 26, D68). Outside the migration backups; scripts/backup.sh keeps them.
export interface CoverFields {
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  // Pending: the bytes from the browser, never served. Rated: the image re-encoded by the filter.
  data: Buffer;
  size: number;
  state: CoverState;
  scores?: CoverScores;
  model?: string;
  // The filter's verdict: it locks the folder's 18+ mark (task 65).
  autoAdult?: boolean;
  // Set by the owner; it does not lock the folder.
  manualAdult?: boolean;
  // Set by the admin (task 88): true locks the owner's mark, false overrides the other two.
  adminAdult?: boolean;
  // Failed classifier calls so far.
  attempts: number;
  // Pending only: when the next try may start (D68 schedule, or a claim's lease).
  nextAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const coverSchema = new Schema<CoverFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    state: { type: String, enum: ["pending", "rated"], required: true },
    scores: {
      type: new Schema<CoverScores>(
        { nsfl: Number, nsfw: Number, sfw: Number },
        { _id: false },
      ),
    },
    model: { type: String },
    autoAdult: { type: Boolean },
    manualAdult: { type: Boolean },
    adminAdult: { type: Boolean },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date },
  },
  { timestamps: true },
);

coverSchema.index({ folderId: 1 });
coverSchema.index({ userId: 1 });
coverSchema.index(
  { nextAttemptAt: 1 },
  { partialFilterExpression: { state: "pending" } },
);

export const Cover: Model<CoverFields> =
  (mongoose.models.Cover as Model<CoverFields> | undefined) ??
  mongoose.model<CoverFields>("Cover", coverSchema);
