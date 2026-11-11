import mongoose, { Schema, type Model, type Types } from "mongoose";

// Who read a chapter on a day (D80, task 83): `u:<userId>` or `g:<keyed hash of the address>`,
// never the address itself. A new entry adds one to dailyStats; the entry itself expires.
export interface ReadEventFields {
  storyId: Types.ObjectId;
  folderId: Types.ObjectId;
  day: string;
  reader: string;
  expiresAt: Date;
}

const readEventSchema = new Schema<ReadEventFields>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    day: { type: String, required: true },
    reader: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "readEvents", versionKey: false },
);

readEventSchema.index({ storyId: 1, day: 1, reader: 1 }, { unique: true });
// Weekly ranking of books (task 84).
readEventSchema.index({ day: 1, folderId: 1 });
readEventSchema.index({ folderId: 1 });
readEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ReadEvent: Model<ReadEventFields> =
  (mongoose.models.ReadEvent as Model<ReadEventFields> | undefined) ??
  mongoose.model<ReadEventFields>("ReadEvent", readEventSchema);
