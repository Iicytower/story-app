import { isObjectIdOrHexString, Types } from "mongoose";
import { chapterAdultState, folderAdultState } from "@/lib/adult/adult";
import { connectDB } from "@/lib/db";
import { chapterOrder, folderOrder, type Order } from "@/lib/folders/sort";
import { folderLanguage } from "@/lib/languages";
import { coverPath, coversOf } from "@/lib/covers/queries";
import { Cover } from "@/lib/models/cover";
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
      .select({
        name: 1,
        tags: 1,
        lastActivityAt: 1,
        published: 1,
        language: 1,
        adult: 1,
        coverId: 1,
      })
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
  const covers = await coversOf(folders);
  return {
    sort,
    folders: folders.map((folder) => ({
      ...serialize(folder),
      language: folderLanguage(folder.language),
      adult: folderAdultState(folder.adult),
      cover: covers.get(folder._id.toString()) ?? null,
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
      language: 1,
      adult: 1,
      coverId: 1,
      coverRejectedAt: 1,
      commentsDisabled: 1,
    })
    .lean();
  if (!folder) return null;
  const chapterSort = folder.chapterSort ?? "created";
  const [cover, pending] = await Promise.all([
    folder.coverId
      ? Cover.findOne({ _id: folder.coverId, state: "rated" })
          .select({ manualAdult: 1, autoAdult: 1 })
          .lean()
      : null,
    Cover.exists({ folderId: folder._id, state: "pending" }),
  ]);
  const chapters = await findChaptersInOrder(
    userId,
    id,
    chapterOrder(chapterSort),
  )
    .select({
      title: 1,
      content: 1,
      tags: 1,
      publication: 1,
      updatedAt: 1,
      adult: 1,
    })
    .lean();
  return {
    ...serialize(folder),
    language: folderLanguage(folder.language),
    adult: folderAdultState(folder.adult),
    cover: cover && {
      id: cover._id.toString(),
      path: coverPath(cover._id),
      manualAdult: Boolean(cover.manualAdult),
      autoAdult: Boolean(cover.autoAdult),
    },
    coverPending: Boolean(pending),
    coverRejected: Boolean(folder.coverRejectedAt),
    commentsDisabled: Boolean(folder.commentsDisabled),
    chapterSort,
    chapters: chapters.map((chapter) => ({
      ...serialize(chapter),
      adult: chapterAdultState(chapter.adult, folder.adult),
    })),
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
      coverId: 1,
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
    .select({
      name: 1,
      notes: 1,
      notesUpdatedAt: 1,
      chapterSort: 1,
      language: 1,
    })
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
    language: folderLanguage(folder.language),
    chapterSort,
    chapters: chapters.map(({ _id, title }) => ({ id: _id.toString(), title })),
  };
}

export type EditorFolder = NonNullable<
  Awaited<ReturnType<typeof getEditorFolder>>
>;
