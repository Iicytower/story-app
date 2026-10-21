"use server";

import { isObjectIdOrHexString, type Types } from "mongoose";
import { refresh } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import {
  FolderVersion,
  type FolderVersionFields,
} from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";
import {
  deleteVersion,
  type Restore,
  restore,
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

const INVALID_SELECTION: ActionError = {
  ok: false,
  error: "INVALID_INPUT",
  message: "The folder has changed. Reload the page and select chapters again.",
};

// What to restore, from the version and the folder's current chapter ids.
type Plan = (
  version: Pick<FolderVersionFields, "chapterSort" | "chapters">,
  current: Types.ObjectId[],
) => Restore | ActionError;

// Saves the folder as a new version first, so the restore can be undone.
async function restoreVersion(
  folderId: string,
  number: number,
  plan: Plan,
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
    .select({ chapterSort: 1, chapters: 1 })
    .lean();
  if (!version) return NOT_FOUND;
  const current = await Story.find({
    userId: user.userId,
    folderId,
    deletedAt: null,
  }).distinct("_id");
  const changes = plan(version, current);
  if ("ok" in changes) return changes;

  const savedNumber = await saveVersion(
    user.userId,
    folderId,
    beforeRestoreName(number),
  );
  if (savedNumber === null) return FOLDER_NOT_FOUND;
  await restore(user.userId, folderId, changes);

  refresh();
  return { ok: true, savedNumber };
}

// Like git reset: the folder's chapters, their order and sort mode become the version's,
// and chapters added since are deleted.
export async function restoreEntireVersion(
  folderId: string,
  number: number,
): Promise<ActionResult<{ savedNumber: number }>> {
  return restoreVersion(folderId, number, (version, current) => {
    const saved = new Set(version.chapters.map((c) => c.storyId.toString()));
    return {
      chapters: version.chapters,
      remove: current.filter((id) => !saved.has(id.toString())),
      order: { chapterSort: version.chapterSort, chapters: version.chapters },
    };
  });
}

// storyIds: chapters of the version to bring back; removeIds: chapters added since to delete.
export async function restoreFolderVersion(
  folderId: string,
  number: number,
  storyIds: string[],
  removeIds: string[],
): Promise<ActionResult<{ savedNumber: number }>> {
  return restoreVersion(folderId, number, (version, current) => {
    const requested = new Set(Array.isArray(storyIds) ? storyIds : []);
    const toRemove = new Set(Array.isArray(removeIds) ? removeIds : []);
    const saved = new Set(version.chapters.map((c) => c.storyId.toString()));
    const chapters = version.chapters.filter((chapter) =>
      requested.has(chapter.storyId.toString()),
    );
    const remove = current.filter(
      (id) => toRemove.has(id.toString()) && !saved.has(id.toString()),
    );
    if (chapters.length + remove.length === 0) {
      return {
        ok: false,
        error: "INVALID_INPUT",
        message: "Select chapters to restore or remove.",
      };
    }
    if (chapters.length !== requested.size || remove.length !== toRemove.size) {
      return INVALID_SELECTION;
    }
    return { chapters, remove };
  });
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
