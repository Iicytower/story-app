import type { Types } from "mongoose";
import { isDuplicateKeyError } from "@/lib/db";
import { Folder } from "@/lib/models/folder";

// Matches names exactly like the unique index: case-sensitive, after trim() by the caller.
export async function findOrCreateFolder(
  userId: string,
  name: string,
): Promise<Types.ObjectId> {
  const filter = { userId, name, deletedAt: null };
  const existing = await Folder.findOne(filter).select({ _id: 1 }).lean();
  if (existing) return existing._id;
  try {
    return (await Folder.create({ userId, name }))._id;
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
