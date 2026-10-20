import { isObjectIdOrHexString } from "mongoose";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
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
  const [stories, folders] = await Promise.all([
    Story.find(filter)
      .select({ title: 1, content: 1, folderId: 1, updatedAt: 1 })
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),
    Folder.find({ userId, deletedAt: null }).select({ name: 1 }).lean(),
  ]);
  const folderNames = new Map(
    folders.map((folder) => [folder._id.toString(), folder.name]),
  );
  return stories.map((story) => ({
    ...serialize(story),
    folderName: folderNames.get(story.folderId?.toString()) ?? "",
  }));
}

export type StoryListItem = Awaited<ReturnType<typeof listStories>>[number];

export async function getStory(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const story = await Story.findOne({ _id: id, userId, deletedAt: null })
    .select({
      title: 1,
      content: 1,
      notes: 1,
      shareToken: 1,
      folderId: 1,
      updatedAt: 1,
    })
    .lean();
  if (!story) return null;
  // A story created by v1.0 during a deploy has no folder until the next migration run.
  const folder =
    story.folderId &&
    (await Folder.findOne({ _id: story.folderId, deletedAt: null })
      .select({ name: 1 })
      .lean());
  return { ...serialize(story), folderName: folder ? folder.name : null };
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
