import { isObjectIdOrHexString } from "mongoose";
import { connectDB } from "@/lib/db";
import { findChaptersInOrder } from "@/lib/folders/queries";
import { chapterOrder } from "@/lib/folders/sort";
import { ChapterContent } from "@/lib/models/chapter-content";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { compareVersion } from "./versions";

// The caller has checked that the folder is the user's active folder.
export async function listFolderVersions(userId: string, folderId: string) {
  await connectDB();
  const versions = await FolderVersion.find({ userId, folderId })
    .sort({ number: -1 })
    .select({ number: 1, name: 1, createdAt: 1, "chapters.storyId": 1 })
    .lean();
  return versions.map(({ number, name, createdAt, chapters }) => ({
    number,
    name,
    createdAt: createdAt.toISOString(),
    chapterCount: chapters.length,
  }));
}

export type VersionListItem = Awaited<
  ReturnType<typeof listFolderVersions>
>[number];

// The version compared with the folder's current chapters. null for another user's
// version and for versions of a deleted folder.
export async function getFolderVersion(
  userId: string,
  folderId: string,
  number: number,
) {
  if (!isObjectIdOrHexString(folderId) || !Number.isInteger(number)) {
    return null;
  }
  await connectDB();
  const folder = await Folder.findOne({ _id: folderId, userId, deletedAt: null })
    .select({ name: 1, chapterSort: 1 })
    .lean();
  if (!folder) return null;
  const version = await FolderVersion.findOne({
    userId,
    folderId,
    number,
  }).lean();
  if (!version) return null;

  const [contents, current] = await Promise.all([
    ChapterContent.find({
      _id: { $in: version.chapters.map((chapter) => chapter.contentId) },
      userId,
    }).lean(),
    findChaptersInOrder(
      userId,
      folderId,
      chapterOrder(folder.chapterSort ?? "created"),
    )
      .select({ title: 1, content: 1 })
      .lean(),
  ]);
  const byId = new Map(contents.map((content) => [content._id, content]));
  const comparison = compareVersion(
    version.chapters.map((chapter) => {
      const { title, content } = byId.get(chapter.contentId)!;
      return { storyId: chapter.storyId.toString(), title, content };
    }),
    current.map(({ _id, title, content }) => ({
      id: _id.toString(),
      title,
      content,
    })),
  );

  return {
    folder: { id: folder._id.toString(), name: folder.name },
    number: version.number,
    name: version.name,
    createdAt: version.createdAt.toISOString(),
    comparison,
  };
}

export type FolderVersionView = NonNullable<
  Awaited<ReturnType<typeof getFolderVersion>>
>;
