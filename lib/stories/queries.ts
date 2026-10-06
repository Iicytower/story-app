import { connectDB } from "@/lib/db";
import { Story } from "@/lib/models/story";
import { serialize } from "@/lib/serialize";
import { escapeRegex } from "./search";

export async function listStories(userId: string, query?: string) {
  await connectDB();
  const filter: Record<string, unknown> = { userId, deletedAt: null };
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ title: pattern }, { content: pattern }];
  }
  const stories = await Story.find(filter)
    .select({ title: 1, content: 1, updatedAt: 1 })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  return stories.map(serialize);
}

export type StoryListItem = Awaited<ReturnType<typeof listStories>>[number];
