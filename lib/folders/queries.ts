import { isObjectIdOrHexString, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { chapterOrder, folderOrder, type Order } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { serialize } from "@/lib/serialize";

export async function getFolderSort(userId: string) {
  const user = await User.findById(userId).select({ folderSort: 1 }).lean();
  // lean() applies no schema defaults.
  return user?.folderSort ?? "updated";
}

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
  const sort = await getFolderSort(userId);
  const [folders, counts] = await Promise.all([
    findFoldersInOrder(userId, folderOrder(sort))
      .select({ name: 1, lastActivityAt: 1 })
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
    .select({ name: 1, notes: 1, notesUpdatedAt: 1, chapterSort: 1 })
    .lean();
  if (!folder) return null;
  const chapterSort = folder.chapterSort ?? "created";
  const chapters = await findChaptersInOrder(
    userId,
    id,
    chapterOrder(chapterSort),
  )
    .select({ title: 1, content: 1, updatedAt: 1 })
    .lean();
  return {
    ...serialize(folder),
    chapterSort,
    chapters: chapters.map(serialize),
  };
}

export type FolderView = NonNullable<Awaited<ReturnType<typeof getFolder>>>;
