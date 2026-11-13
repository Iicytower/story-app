import mongoose, { Schema, type Model, type Types } from "mongoose";

// Public profile (task 70, D80). Missing document = empty bio, no avatar, public library.
export interface ProfileFields {
  userId: Types.ObjectId;
  bio: string;
  avatarId?: Types.ObjectId;
  libraryPublic: boolean;
  // Set once the starter shelves were created (task 72); only the request that sets it creates them.
  shelvesSeededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<ProfileFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bio: { type: String, default: "" },
    avatarId: { type: Schema.Types.ObjectId, ref: "Avatar" },
    libraryPublic: { type: Boolean, default: true },
    shelvesSeededAt: { type: Date },
  },
  { timestamps: true },
);

profileSchema.index({ userId: 1 }, { unique: true });

export const Profile: Model<ProfileFields> =
  (mongoose.models.Profile as Model<ProfileFields> | undefined) ??
  mongoose.model<ProfileFields>("Profile", profileSchema);
