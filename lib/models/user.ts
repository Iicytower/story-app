import mongoose, { Schema, type Model } from "mongoose";

// Nicknames keep their case for display but compare case-insensitively.
export const NICKNAME_COLLATION = { locale: "en", strength: 2 };

// Preferences live in the settings collection (lib/models/settings.ts).
export interface UserFields {
  nickname: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<UserFields>(
  {
    nickname: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Partial: accounts from before task 36 get their nickname by hand and must not collide on null meanwhile.
userSchema.index(
  { nickname: 1 },
  {
    unique: true,
    collation: NICKNAME_COLLATION,
    partialFilterExpression: { nickname: { $type: "string" } },
  },
);

export const User: Model<UserFields> =
  (mongoose.models.User as Model<UserFields> | undefined) ??
  mongoose.model<UserFields>("User", userSchema);
