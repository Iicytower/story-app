import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";

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
