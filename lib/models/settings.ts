import mongoose, { Schema, type Model, type Types } from "mongoose";
import { FOLDER_SORTS } from "@/lib/folders/sort";
import { routing } from "@/i18n/routing";
import { MAX_WORD_LENGTH } from "@/lib/proofreading/dictionary";
import {
  ACCENTS,
  DM_FROM,
  MOBILE_VIEWS,
  THEMES,
} from "@/lib/settings/settings";
import { OPTIONAL_NOTIFICATION_TYPES } from "@/lib/social/notifications";

// Only values the user chose are stored, without defaults: getUserSettings fills in the
// rest, so a changed default reaches existing users too.
export interface SettingsFields {
  userId: Types.ObjectId;
  editor?: { layout?: unknown; mobileView?: string };
  appearance?: {
    theme?: string | null;
    accent?: string;
    sidebarCollapsed?: boolean;
    editorSidebarCollapsed?: boolean;
    locale?: string | null;
  };
  folders?: { sort?: string; manualOrder?: boolean };
  proofreading?: { dictionary?: string[] };
  messages?: { dmFrom?: string };
  notifications?: Record<string, boolean | undefined>;
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
      accent: { type: String, enum: ACCENTS },
      sidebarCollapsed: { type: Boolean },
      editorSidebarCollapsed: { type: Boolean },
      locale: { type: String, enum: [...routing.locales, null] },
    },
    folders: {
      sort: { type: String, enum: FOLDER_SORTS },
      manualOrder: { type: Boolean },
    },
    proofreading: {
      // Without a default Mongoose would store an empty list for every user.
      dictionary: {
        type: [{ type: String, maxLength: MAX_WORD_LENGTH }],
        default: undefined,
      },
    },
    messages: { dmFrom: { type: String, enum: DM_FROM } },
    notifications: Object.fromEntries(
      OPTIONAL_NOTIFICATION_TYPES.map((type) => [type, { type: Boolean }]),
    ),
  },
  { timestamps: true, collection: "settings" },
);

export const Settings: Model<SettingsFields> =
  (mongoose.models.Settings as Model<SettingsFields> | undefined) ??
  mongoose.model<SettingsFields>("Settings", settingsSchema);
