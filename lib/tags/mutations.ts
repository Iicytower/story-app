import type { ErrorMessage } from "@/lib/i18n/messages";
import { connectDB } from "@/lib/db";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { type PredefinedTagView, validatePredefinedTag } from "./predefined";

async function currentTags(): Promise<PredefinedTagView[]> {
  const tags = await PredefinedTag.find().lean();
  return tags.map(({ _id, labels }) => ({ key: _id, labels }));
}

// One write for `npm run tags` and the admin panel (task 88): the same check in both.
export async function savePredefinedTag(
  entry: PredefinedTagView,
): Promise<ErrorMessage | null> {
  await connectDB();
  const tag = {
    key: entry.key,
    labels: { en: entry.labels.en.trim(), pl: entry.labels.pl.trim() },
  };
  const error = validatePredefinedTag(tag, await currentTags());
  if (error) return error;
  await PredefinedTag.updateOne(
    { _id: tag.key },
    { $set: { labels: tag.labels } },
    { upsert: true },
  );
  return null;
}

// The key stays in folders and chapters, where it becomes an own tag again (D79).
export async function removePredefinedTag(key: string): Promise<boolean> {
  await connectDB();
  const { deletedCount } = await PredefinedTag.deleteOne({ _id: key });
  return deletedCount > 0;
}
