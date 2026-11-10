import mongoose, { Schema, type Model, type Types } from "mongoose";

// followerId follows followeeId, one way and without approval (D80).
export interface FollowFields {
  followerId: Types.ObjectId;
  followeeId: Types.ObjectId;
  createdAt: Date;
}

const followSchema = new Schema<FollowFields>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followerId: 1, createdAt: -1, _id: -1 });
followSchema.index({ followeeId: 1, createdAt: -1, _id: -1 });

export const Follow: Model<FollowFields> =
  (mongoose.models.Follow as Model<FollowFields> | undefined) ??
  mongoose.model<FollowFields>("Follow", followSchema);
