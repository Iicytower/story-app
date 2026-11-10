import mongoose, { Schema, type Model, type Types } from "mongoose";

// One signed-in device (D75). The JWT carries the id; deleting the document ends the session.
export interface SessionFields {
  _id: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionFields>(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: "sessions",
    versionKey: false,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });

export const AuthSession: Model<SessionFields> =
  (mongoose.models.AuthSession as Model<SessionFields> | undefined) ??
  mongoose.model<SessionFields>("AuthSession", sessionSchema);
