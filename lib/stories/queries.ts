import { isObjectIdOrHexString } from "mongoose";
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

export async function getStory(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const story = await Story.findOne({ _id: id, userId, deletedAt: null })
    .select({ title: 1, content: 1, notes: 1, shareToken: 1, updatedAt: 1 })
    .lean();
  return story && serialize(story);
}

export type EditorStory = NonNullable<Awaited<ReturnType<typeof getStory>>>;

export async function getStoryForExport(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const story = await Story.findOne({ _id: id, userId, deletedAt: null })
    .select({ title: 1, content: 1, notes: 1, createdAt: 1, updatedAt: 1 })
    .lean();
  return story && serialize(story);
}

export async function getSharedStory(token: string) {
  await connectDB();
  return Story.findOne({ shareToken: token, deletedAt: null })
    .select({ _id: 0, title: 1, content: 1 })
    .lean<{ title: string; content: string }>();
}
