import mongoose, { Schema, type Model, type Types } from "mongoose";
import { FOLDER_SORTS } from "@/lib/folders/sort";
import { MOBILE_VIEWS, THEMES } from "@/lib/settings/settings";

// Only values the user chose are stored, without defaults: getUserSettings fills in the
// rest, so a changed default reaches existing users too.
export interface SettingsFields {
  userId: Types.ObjectId;
  editor?: { layout?: unknown; mobileView?: string };
  appearance?: { theme?: string | null };
  folders?: { sort?: string; manualOrder?: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsFields>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    editor: {
      // Validated by normalizeLayout on read and write.
      layout: { type: Schema.Types.Mixed },
      mobileView: { type: String, enum: MOBILE_VIEWS },
    },
    appearance: {
      theme: { type: String, enum: [...THEMES, null] },
    },
    folders: {
      sort: { type: String, enum: FOLDER_SORTS },
      manualOrder: { type: Boolean },
    },
  },
  { timestamps: true, collection: "settings" },
);

export const Settings: Model<SettingsFields> =
  (mongoose.models.Settings as Model<SettingsFields> | undefined) ??
  mongoose.model<SettingsFields>("Settings", settingsSchema);
