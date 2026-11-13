import mongoose, { Schema, type Model, type Types } from "mongoose";

// A global forum category (D80, task 87), keyed like the predefined tags (D79). The admin manages
// them in task 88; adminOnly lets only admins write, as in the announcements.
export interface ForumCategoryFields {
  _id: string;
  labels: { en: string; pl: string };
  scope: "global";
  adminOnly?: boolean;
  order: number;
  moderatorIds: Types.ObjectId[];
}

const forumCategorySchema = new Schema<ForumCategoryFields>(
  {
    _id: { type: String, required: true },
    labels: {
      type: new Schema(
        {
          en: { type: String, required: true },
          pl: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    scope: { type: String, enum: ["global"], default: "global" },
    adminOnly: { type: Boolean },
    order: { type: Number, required: true },
    moderatorIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  { versionKey: false },
);

forumCategorySchema.index({ moderatorIds: 1 });

export const ForumCategory: Model<ForumCategoryFields> =
  (mongoose.models.ForumCategory as Model<ForumCategoryFields> | undefined) ??
  mongoose.model<ForumCategoryFields>(
    "ForumCategory",
    forumCategorySchema,
    "forumCategories",
  );
