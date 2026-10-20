import { isObjectIdOrHexString, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { serialize } from "@/lib/serialize";

export async function listFolders(userId: string) {
  await connectDB();
  const [folders, counts] = await Promise.all([
    Folder.find({ userId, deletedAt: null })
      .select({ name: 1, lastActivityAt: 1 })
      .sort({ lastActivityAt: -1, _id: -1 })
      .lean(),
    // aggregate() does not cast, so userId has to be an ObjectId here.
    Story.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: new Types.ObjectId(userId), deletedAt: null } },
      { $group: { _id: "$folderId", count: { $sum: 1 } } },
    ]),
  ]);
  const countByFolder = new Map(
    counts.map(({ _id, count }) => [_id?.toString(), count]),
  );
  return folders.map((folder) => ({
    ...serialize(folder),
    chapterCount: countByFolder.get(folder._id.toString()) ?? 0,
  }));
}

export type FolderListItem = Awaited<ReturnType<typeof listFolders>>[number];

export async function getFolder(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const folder = await Folder.findOne({ _id: id, userId, deletedAt: null })
    .select({ name: 1, notes: 1, notesUpdatedAt: 1 })
    .lean();
  if (!folder) return null;
  // Newest first until task 03 adds sort modes.
  const chapters = await Story.find({ userId, folderId: id, deletedAt: null })
    .select({ title: 1, content: 1, updatedAt: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  return { ...serialize(folder), chapters: chapters.map(serialize) };
}

export type FolderView = NonNullable<Awaited<ReturnType<typeof getFolder>>>;
