import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MAX_BAN_REASON_LENGTH } from "@/lib/limits";

// userId is banned in the community of authorId (D80); `until: null` = without end.
export interface CommunityBanFields {
  authorId: Types.ObjectId;
  userId: Types.ObjectId;
  until: Date | null;
  reason: string;
  by: Types.ObjectId;
  createdAt: Date;
}

const communityBanSchema = new Schema<CommunityBanFields>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    until: { type: Date, default: null },
    reason: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: MAX_BAN_REASON_LENGTH,
    },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    collection: "communityBans",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

communityBanSchema.index({ authorId: 1, userId: 1 }, { unique: true });

export const CommunityBan: Model<CommunityBanFields> =
  (mongoose.models.CommunityBan as Model<CommunityBanFields> | undefined) ??
  mongoose.model<CommunityBanFields>("CommunityBan", communityBanSchema);
