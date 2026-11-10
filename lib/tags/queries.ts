import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { Story } from "@/lib/models/story";
import type { PredefinedTagView } from "./predefined";

export async function listUserTags(userId: string): Promise<string[]> {
  await connectDB();
  const owned = { userId, deletedAt: null };
  const [folderTags, storyTags] = await Promise.all([
    Folder.distinct("tags", owned),
    Story.distinct("tags", owned),
  ]);
  return [...new Set<string>([...folderTags, ...storyTags])].sort((a, b) =>
    a.localeCompare(b),
  );
}

// Read once per request: the layout, the search and the actions all need it.
export const listPredefinedTags = cache(
  async (): Promise<PredefinedTagView[]> => {
    await connectDB();
    const tags = await PredefinedTag.find().sort({ _id: 1 }).lean();
    return tags.map(({ _id, labels }) => ({ key: _id, labels }));
  },
);
