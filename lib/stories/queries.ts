import { isObjectIdOrHexString } from "mongoose";
import { chapterAdultState, isAdult } from "@/lib/adult/adult";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { chapterPublicPath } from "@/lib/publish/queries";
import { serialize } from "@/lib/serialize";
import { tagsForQuery } from "@/lib/tags/predefined";
import { listPredefinedTags } from "@/lib/tags/queries";
import { buildStoryFilter } from "./search";

export async function listStories(
  userId: string,
  query?: string,
  tags: string[] = [],
) {
  await connectDB();
  const [folders, predefined] = await Promise.all([
    Folder.find({ userId, deletedAt: null })
      .select({ name: 1, tags: 1, adult: 1 })
      .lean(),
    listPredefinedTags(),
  ]);
  const stories = await Story.find(
    buildStoryFilter(
      userId,
      query,
      tags,
      folders,
      tagsForQuery(query ?? "", predefined),
    ),
  )
    .select({
      title: 1,
      content: 1,
      folderId: 1,
      tags: 1,
      updatedAt: 1,
      adult: 1,
    })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  const foldersById = new Map(
    folders.map((folder) => [folder._id.toString(), folder]),
  );
  return stories.map((story) => {
    const folder = foldersById.get(story.folderId?.toString());
    return {
      ...serialize(story),
      folderName: folder?.name ?? "",
      folderTags: folder?.tags ?? [],
      adult: isAdult(story.adult) || isAdult(folder?.adult),
    };
  });
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
      publication: 1,
      folderId: 1,
      updatedAt: 1,
      proofreading: 1,
      adult: 1,
      commentsDisabled: 1,
    })
    .lean();
  if (!story) return null;
  // A story created by v1.0 during a deploy has no folder until the next migration run.
  const folder =
    story.folderId &&
    (await Folder.findOne({ _id: story.folderId, deletedAt: null })
      .select({ name: 1, published: 1, adult: 1 })
      .lean());
  return {
    ...serialize(story),
    folderName: folder ? folder.name : null,
    adult: chapterAdultState(story.adult, folder ? folder.adult : undefined),
    commentsDisabled: Boolean(story.commentsDisabled),
    publicPath:
      folder && folder.published && story.publication === "public"
        ? await chapterPublicPath(userId, folder._id.toString(), id)
        : null,
  };
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

// Home page shortcut (D83): the user's chapter changed last, in a book that still exists.
export async function getLastEditedChapter(userId: string) {
  await connectDB();
  const folders = await Folder.find({ userId, deletedAt: null })
    .select({ name: 1 })
    .lean();
  const story = await Story.findOne({
    userId,
    folderId: { $in: folders.map(({ _id }) => _id) },
    deletedAt: null,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .select({ title: 1, folderId: 1 })
    .lean();
  if (!story) return null;
  const folder = folders.find(({ _id }) => _id.equals(story.folderId));
  return { id: story._id.toString(), title: story.title, bookName: folder!.name };
}
