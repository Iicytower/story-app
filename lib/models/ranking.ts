import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface RankingItem {
  folderId: Types.ObjectId;
  storyId?: Types.ObjectId;
  score: number;
}

// Home page rankings (D80, task 84): `weekly` and `topRated`, recomputed lazily.
// `computing` is the end of a claim's lease, so a crashed computation does not block the next.
export interface RankingFields {
  _id: string;
  items: RankingItem[];
  computedAt: Date;
  computing?: Date | null;
}

const rankingSchema = new Schema<RankingFields>(
  {
    _id: { type: String, required: true },
    items: {
      type: [
        new Schema<RankingItem>(
          {
            folderId: { type: Schema.Types.ObjectId, ref: "Folder" },
            storyId: { type: Schema.Types.ObjectId, ref: "Story" },
            score: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    computedAt: { type: Date, required: true },
    computing: { type: Date, default: null },
  },
  { versionKey: false },
);

export const Ranking: Model<RankingFields> =
  (mongoose.models.Ranking as Model<RankingFields> | undefined) ??
  mongoose.model<RankingFields>("Ranking", rankingSchema, "rankings");
