import mongoose, { Schema, type Model } from "mongoose";
import { routing, type Locale } from "@/i18n/routing";

// A curated tag (D79). _id is the canonical key stored in `tags` of folders and chapters.
export interface PredefinedTagFields {
  _id: string;
  labels: Record<Locale, string>;
}

const predefinedTagSchema = new Schema<PredefinedTagFields>(
  {
    _id: { type: String, required: true },
    labels: Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        { type: String, required: true },
      ]),
    ),
  },
  { collection: "predefinedTags", versionKey: false },
);

export const PredefinedTag: Model<PredefinedTagFields> =
  (mongoose.models.PredefinedTag as Model<PredefinedTagFields> | undefined) ??
  mongoose.model<PredefinedTagFields>("PredefinedTag", predefinedTagSchema);
