import type { Types } from "mongoose";
import { isDuplicateKeyError } from "@/lib/db";
import type { Direction } from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";

// Matches names exactly like the unique index: case-sensitive, after trim() by the caller.
export async function findOrCreateFolder(
  userId: string,
  name: string,
): Promise<Types.ObjectId> {
  const filter = { userId, name, deletedAt: null };
  const existing = await Folder.findOne(filter).select({ _id: 1 }).lean();
  if (existing) return existing._id;
  try {
    const position = await nextFolderPosition(userId);
    return (await Folder.create({ userId, name, position }))._id;
  } catch (error) {
    // Another request created the same folder in the meantime.
    if (!isDuplicateKeyError(error)) throw error;
    const created = await Folder.findOne(filter).select({ _id: 1 }).lean();
    return created!._id;
  }
}

export async function touchFolder(
  folderId: Types.ObjectId | string,
  at = new Date(),
): Promise<void> {
  await Folder.updateOne(
    { _id: folderId, lastActivityAt: { $lt: at } },
    { $set: { lastActivityAt: at } },
    { timestamps: false },
  );
}

// New folders and chapters go to the end of the manual order.
export async function nextFolderPosition(userId: string): Promise<number> {
  const last = await Folder.findOne({ userId, deletedAt: null })
    .sort({ position: -1 })
    .select({ position: 1 })
    .lean();
  return (last?.position ?? -1) + 1;
}

export async function nextChapterPosition(
  userId: string,
  folderId: Types.ObjectId | string,
): Promise<number> {
  const last = await Story.findOne({ userId, folderId, deletedAt: null })
    .sort({ position: -1 })
    .select({ position: 1 })
    .lean();
  return (last?.position ?? -1) + 1;
}

type Positioned = { _id: Types.ObjectId; position?: number };

// Returns null when the id is not in the list, and the list unchanged at either end.
export function moveInList<T extends Positioned>(
  items: T[],
  id: string,
  direction: Direction,
): T[] | null {
  const index = items.findIndex((item) => item._id.toString() === id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

// Renumbers the whole list instead of swapping two values: positions can be
// equal (concurrent creates) or missing (documents from older deployments).
// The native driver leaves updatedAt alone.
export async function savePositions(
  model: typeof Folder | typeof Story,
  items: Positioned[],
): Promise<void> {
  const operations = items.flatMap((item, position) =>
    item.position === position
      ? []
      : [
          {
            updateOne: {
              filter: { _id: item._id },
              update: { $set: { position } },
            },
          },
        ],
  );
  if (operations.length > 0) await model.collection.bulkWrite(operations);
}
