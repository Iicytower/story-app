import mongoose, { Schema, type Model } from "mongoose";

export interface RateLimitFields {
  _id: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<RateLimitFields>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "rateLimits", versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<RateLimitFields> =
  (mongoose.models.RateLimit as Model<RateLimitFields> | undefined) ??
  mongoose.model<RateLimitFields>("RateLimit", rateLimitSchema);
