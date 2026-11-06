import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { StoredProofreading } from "@/lib/proofreading/stored";

export type Publication = "public" | "hidden";

export interface StoryFields {
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  title: string;
  content: string;
  notes: string;
  // Order in the folder's manual mode; missing on stories created by older deployments.
  position?: number;
  // Missing on stories created by older deployments until migration 005 runs again.
  tags?: string[];
  // Missing means no decision yet: publishing the folder makes the chapter public.
  publication?: Publication;
  // Addresses from before a title change; they redirect to the current one.
  formerSlugs?: string[];
  // When the chapter last became publicly visible; missing while it is not.
  publishedAt?: Date;
  // The open proofreading of the chapter (task 55); missing when there is none.
  proofreading?: StoredProofreading;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const storySchema = new Schema<StoryFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    notes: { type: String, default: "" },
    position: { type: Number },
    tags: { type: [String] },
    publication: { type: String, enum: ["public", "hidden"] },
    formerSlugs: { type: [String], default: undefined },
    publishedAt: { type: Date },
    // Checked by parseStoredProofreading in saveStory.
    proofreading: { type: Schema.Types.Mixed },
    // Always stored: a partial index filter cannot express "field does not exist".
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

storySchema.index(
  { userId: 1, folderId: 1, title: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
storySchema.index({ userId: 1, updatedAt: -1 });
storySchema.index({ publication: 1, publishedAt: -1 });

export const Story: Model<StoryFields> =
  (mongoose.models.Story as Model<StoryFields> | undefined) ??
  mongoose.model<StoryFields>("Story", storySchema);
