import mongoose, { Schema, type Model, type Types } from "mongoose";

// Nicknames keep their case for display but compare case-insensitively.
export const NICKNAME_COLLATION = { locale: "en", strength: 2 };

// Preferences live in the settings collection (lib/models/settings.ts).
export interface UserFields {
  nickname: string;
  // Missing on a deleted account's tombstone (task 89), which no password signs in to.
  passwordHash?: string;
  // Hashes only (D76). Missing on accounts from before task 63, which have none.
  recoveryCodes?: { hash: string; usedAt: Date | null }[];
  // Missing = a regular account (D80); set with npm run admin.
  role?: "admin";
  // Read-only mode (D80); `until: null` = without end. An expired ban stays until replaced.
  globalBan?: GlobalBan;
  // A deleted account (task 89): the document keeps only the nickname, so nobody takes it over.
  deletedAt?: Date;
  // Set while the deleted account's data is still being removed; a retry takes it over.
  cleanupPendingAt?: Date;
  createdAt: Date;
}

// Accounts that were not deleted; spread into every query of users except name lookups that
// show a deleted account as such.
export const NOT_DELETED = { deletedAt: { $exists: false } } as const;

export interface GlobalBan {
  until: Date | null;
  reason: string;
  by: Types.ObjectId;
  at: Date;
}

const userSchema = new Schema<UserFields>(
  {
    nickname: { type: String, required: true, trim: true },
    passwordHash: { type: String },
    recoveryCodes: {
      type: [
        {
          _id: false,
          hash: { type: String, required: true },
          usedAt: { type: Date, default: null },
        },
      ],
      default: undefined,
    },
    role: { type: String, enum: ["admin"] },
    globalBan: {
      type: new Schema<GlobalBan>(
        {
          until: { type: Date, default: null },
          reason: { type: String, required: true },
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    deletedAt: { type: Date },
    cleanupPendingAt: { type: Date },
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

// For hiddenUserIdsFor: the accounts that ever had a global ban, not every account.
userSchema.index(
  { "globalBan.until": 1 },
  { partialFilterExpression: { globalBan: { $exists: true } } },
);

// The admins who get reports of the admin route (task 81), not every account.
userSchema.index(
  { role: 1 },
  { partialFilterExpression: { role: { $exists: true } } },
);

// The retry of an interrupted cleanup, not every account.
userSchema.index(
  { cleanupPendingAt: 1 },
  { partialFilterExpression: { cleanupPendingAt: { $exists: true } } },
);

export const User: Model<UserFields> =
  (mongoose.models.User as Model<UserFields> | undefined) ??
  mongoose.model<UserFields>("User", userSchema);
