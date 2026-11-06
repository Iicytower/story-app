import { cache } from "react";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { Settings } from "@/lib/models/settings";
import { MAX_DICTIONARY_WORDS } from "@/lib/proofreading/dictionary";
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

async function dictionaryOf(userId: string): Promise<string[]> {
  return normalizeSettings(await Settings.findOne({ userId }).lean())
    .proofreading.dictionary;
}

// Null when the dictionary is full. One conditional update, so parallel adds (two tabs)
// cannot go past the limit or store a word twice.
export async function addDictionaryWord(
  userId: string,
  word: string,
): Promise<string[] | null> {
  await connectDB();
  const create = () =>
    Settings.updateOne(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true },
    );
  try {
    await create();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  const { modifiedCount } = await Settings.updateOne(
    {
      userId,
      "proofreading.dictionary": { $ne: word },
      [`proofreading.dictionary.${MAX_DICTIONARY_WORDS - 1}`]: {
        $exists: false,
      },
    },
    { $push: { "proofreading.dictionary": word } },
    { runValidators: true },
  );
  const words = await dictionaryOf(userId);
  return modifiedCount === 0 && !words.includes(word) ? null : words;
}

export async function removeDictionaryWord(
  userId: string,
  word: string,
): Promise<string[]> {
  await connectDB();
  await Settings.updateOne(
    { userId },
    { $pull: { "proofreading.dictionary": word } },
  );
  return dictionaryOf(userId);
}

export async function getDictionary(userId: string): Promise<string[]> {
  await connectDB();
  return dictionaryOf(userId);
}
