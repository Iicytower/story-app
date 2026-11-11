import mongoose, { Schema, type Model, type Types } from "mongoose";

// Unique readers of a chapter on a UTC day (D80, task 83); kept after its readEvents expire.
export interface DailyStatFields {
  storyId: Types.ObjectId;
  folderId: Types.ObjectId;
  authorId: Types.ObjectId;
  day: string;
  readers: number;
}

const dailyStatSchema = new Schema<DailyStatFields>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    readers: { type: Number, required: true },
  },
  { collection: "dailyStats", versionKey: false },
);

dailyStatSchema.index({ storyId: 1, day: 1 }, { unique: true });
// The author's statistics page.
dailyStatSchema.index({ authorId: 1, day: 1 });
dailyStatSchema.index({ folderId: 1 });

export const DailyStat: Model<DailyStatFields> =
  (mongoose.models.DailyStat as Model<DailyStatFields> | undefined) ??
  mongoose.model<DailyStatFields>("DailyStat", dailyStatSchema);
