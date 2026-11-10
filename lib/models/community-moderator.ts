import mongoose, { Schema, type Model, type Types } from "mongoose";

// userId moderates the community of authorId once the invitation is accepted (D80).
export interface CommunityModeratorFields {
  authorId: Types.ObjectId;
  userId: Types.ObjectId;
  state: "invited" | "active";
  createdAt: Date;
}

const communityModeratorSchema = new Schema<CommunityModeratorFields>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    state: { type: String, enum: ["invited", "active"], required: true },
  },
  {
    collection: "communityModerators",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

communityModeratorSchema.index({ authorId: 1, userId: 1 }, { unique: true });

export const CommunityModerator: Model<CommunityModeratorFields> =
  (mongoose.models.CommunityModerator as
    Model<CommunityModeratorFields> | undefined) ??
  mongoose.model<CommunityModeratorFields>(
    "CommunityModerator",
    communityModeratorSchema,
  );
