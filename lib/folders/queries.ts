import { isObjectIdOrHexString, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { chapterOrder, folderOrder, type Order } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { serialize } from "@/lib/serialize";
import { getUserSettings } from "@/lib/settings/queries";

export function findFoldersInOrder(userId: string, order: Order) {
  const query = Folder.find({ userId, deletedAt: null }).sort(order.sort);
  return order.collation ? query.collation(order.collation) : query;
}

export function findChaptersInOrder(
  userId: string,
  folderId: string,
  order: Order,
) {
  const query = Story.find({ userId, folderId, deletedAt: null }).sort(
    order.sort,
  );
  return order.collation ? query.collation(order.collation) : query;
}

export async function listFolders(userId: string) {
  await connectDB();
  const { sort } = (await getUserSettings(userId)).folders;
  const [folders, counts] = await Promise.all([
    findFoldersInOrder(userId, folderOrder(sort))
      .select({ name: 1, tags: 1, lastActivityAt: 1 })
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
  return {
    sort,
    folders: folders.map((folder) => ({
      ...serialize(folder),
      chapterCount: countByFolder.get(folder._id.toString()) ?? 0,
    })),
  };
}

export type FolderListItem = Awaited<
  ReturnType<typeof listFolders>
>["folders"][number];

export async function getFolder(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const folder = await Folder.findOne({ _id: id, userId, deletedAt: null })
    .select({
      name: 1,
      notes: 1,
      notesUpdatedAt: 1,
      chapterSort: 1,
      tags: 1,
      published: 1,
    })
    .lean();
  if (!folder) return null;
  const chapterSort = folder.chapterSort ?? "created";
  const chapters = await findChaptersInOrder(
    userId,
    id,
    chapterOrder(chapterSort),
  )
    .select({ title: 1, content: 1, tags: 1, publication: 1, updatedAt: 1 })
    .lean();
  return {
    ...serialize(folder),
    chapterSort,
    chapters: chapters.map(serialize),
  };
}

export type FolderView = NonNullable<Awaited<ReturnType<typeof getFolder>>>;

export async function getFolderForExport(userId: string, id: string) {
  if (!isObjectIdOrHexString(id)) return null;
  await connectDB();
  const folder = await Folder.findOne({ _id: id, userId, deletedAt: null })
    .select({
      name: 1,
      notes: 1,
      createdAt: 1,
      notesUpdatedAt: 1,
      chapterSort: 1,
    })
    .lean();
  if (!folder) return null;
  const chapters = await findChaptersInOrder(
    userId,
    id,
    chapterOrder(folder.chapterSort ?? "created"),
  )
    .select({ title: 1, content: 1, notes: 1, createdAt: 1, updatedAt: 1 })
    .lean();
  return { ...serialize(folder), chapters: chapters.map(serialize) };
}

// The editor's side panels: folder notes and the chapter list, without chapter contents.
export async function getEditorFolder(userId: string, id: string) {
  await connectDB();
  const folder = await Folder.findOne({ _id: id, userId, deletedAt: null })
    .select({ name: 1, notes: 1, notesUpdatedAt: 1, chapterSort: 1 })
    .lean();
  if (!folder) return null;
  const chapterSort = folder.chapterSort ?? "created";
  const chapters = await findChaptersInOrder(
    userId,
    id,
    chapterOrder(chapterSort),
  )
    .select({ title: 1 })
    .lean();
  return {
    id: folder._id.toString(),
    name: folder.name,
    notes: folder.notes,
    notesUpdatedAt: folder.notesUpdatedAt.toISOString(),
    chapterSort,
    chapters: chapters.map(({ _id, title }) => ({ id: _id.toString(), title })),
  };
}

export type EditorFolder = NonNullable<
  Awaited<ReturnType<typeof getEditorFolder>>
>;
