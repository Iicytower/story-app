import type { Types } from "mongoose";
import {
  MAX_CHAPTERS_PER_FOLDER,
  MAX_FOLDERS,
  MAX_VERSIONS_PER_FOLDER,
} from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";

// Checked before the write, so parallel requests can go a few over: the limits only keep one
// account from filling the database (F5), they are not exact quotas.

export async function canAddFolder(userId: string): Promise<boolean> {
  const count = await Folder.countDocuments({ userId, deletedAt: null });
  return count < MAX_FOLDERS;
}

export async function chapterRoom(
  userId: string,
  folderId: Types.ObjectId | string,
): Promise<number> {
  const count = await Story.countDocuments({
    userId,
    folderId,
    deletedAt: null,
  });
  return MAX_CHAPTERS_PER_FOLDER - count;
}

export async function canAddVersion(
  userId: string,
  folderId: string,
): Promise<boolean> {
  const count = await FolderVersion.countDocuments({ userId, folderId });
  return count < MAX_VERSIONS_PER_FOLDER;
}
