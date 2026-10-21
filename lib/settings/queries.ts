import { cache } from "react";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { Settings } from "@/lib/models/settings";
import {
  normalizeSettings,
  type SettingsPatch,
  settingsUpdate,
  type UserSettings,
} from "./settings";

// Cached per request: the root layout (theme), the editor (layout) and the folder list
// (sort) all read it.
export const getUserSettings = cache(
  async (userId: string): Promise<UserSettings> => {
    await connectDB();
    return normalizeSettings(await Settings.findOne({ userId }).lean());
  },
);

export async function updateUserSettings(
  userId: string,
  patch: SettingsPatch,
): Promise<void> {
  await connectDB();
  const update = () =>
    Settings.updateOne(
      { userId },
      { $set: settingsUpdate(patch) },
      { upsert: true, runValidators: true },
    );
  try {
    await update();
  } catch (error) {
    // Two first saves (e.g. layout and theme) can both try to insert the document.
    if (!isDuplicateKeyError(error)) throw error;
    await update();
  }
}
