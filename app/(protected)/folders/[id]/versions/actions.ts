"use server";

import { isObjectIdOrHexString } from "mongoose";
import { refresh } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import {
  deleteVersion,
  restoreChapters,
  saveVersion,
} from "@/lib/versions/mutations";
import { beforeRestoreName, validateVersionName } from "@/lib/versions/versions";

const FOLDER_NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This folder does not exist or has been deleted.",
};

const NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This version does not exist or has been deleted.",
};

const isVersionNumber = (number: unknown): number is number =>
  Number.isInteger(number) && (number as number) > 0;

const activeFolder = (userId: string, folderId: string) =>
  Folder.exists({ _id: folderId, userId, deletedAt: null });

export async function createFolderVersion(
  folderId: string,
  name: string,
): Promise<ActionResult<{ number: number }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(folderId)) return FOLDER_NOT_FOUND;
  const valid = validateVersionName(name);
  if (!valid.ok) return valid;

  await connectDB();
  const number = await saveVersion(user.userId, folderId, valid.name);
  if (number === null) return FOLDER_NOT_FOUND;

  refresh();
  return { ok: true, number };
}

// Saves the folder as a new version first, so the restore can be undone.
export async function restoreFolderVersion(
  folderId: string,
  number: number,
  storyIds: string[],
): Promise<ActionResult<{ savedNumber: number }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(folderId)) return FOLDER_NOT_FOUND;
  if (!isVersionNumber(number)) return NOT_FOUND;

  await connectDB();
  if (!(await activeFolder(user.userId, folderId))) return FOLDER_NOT_FOUND;
  const version = await FolderVersion.findOne({
    userId: user.userId,
    folderId,
    number,
  })
    .select({ chapters: 1 })
    .lean();
  if (!version) return NOT_FOUND;

  const requested = new Set(Array.isArray(storyIds) ? storyIds : []);
  const selected = version.chapters.filter((chapter) =>
    requested.has(chapter.storyId.toString()),
  );
  if (selected.length === 0 || selected.length !== requested.size) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "Select chapters from this version to restore.",
    };
  }

  const savedNumber = await saveVersion(
    user.userId,
    folderId,
    beforeRestoreName(number),
  );
  if (savedNumber === null) return FOLDER_NOT_FOUND;
  await restoreChapters(user.userId, folderId, selected);

  refresh();
  return { ok: true, savedNumber };
}

export async function deleteFolderVersion(
  folderId: string,
  number: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(folderId)) return FOLDER_NOT_FOUND;
  if (!isVersionNumber(number)) return NOT_FOUND;

  await connectDB();
  if (!(await activeFolder(user.userId, folderId))) return FOLDER_NOT_FOUND;
  if (!(await deleteVersion(user.userId, folderId, number))) return NOT_FOUND;

  refresh();
  return { ok: true };
}
