"use server";

import { isObjectIdOrHexString } from "mongoose";
import { refresh } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import {
  moveInList,
  nextFolderPosition,
  savePositions,
} from "@/lib/folders/mutations";
import { findChaptersInOrder, findFoldersInOrder } from "@/lib/folders/queries";
import {
  chapterOrder,
  folderOrder,
  isChapterSort,
  isDirection,
  isFolderSort,
  type Direction,
} from "@/lib/folders/sort";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { rememberFolderSlug } from "@/lib/publish/mutations";
import { getUserSettings, updateUserSettings } from "@/lib/settings/queries";
import { exceedsTagLimit, MAX_TAGS, normalizeTags } from "@/lib/tags/tags";

const NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This folder does not exist or has been deleted.",
};

const EMPTY_NAME: ActionError = {
  ok: false,
  error: "EMPTY_NAME",
  message: "Folder name is required.",
};

const INVALID_INPUT: ActionError = {
  ok: false,
  error: "INVALID_INPUT",
  message: "This option is not available. Reload the page and try again.",
};

const DUPLICATE_NAME: ActionError = {
  ok: false,
  error: "DUPLICATE_NAME",
  message: "A folder with this name already exists.",
};

export async function createFolder(
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const trimmed = name.trim();
  if (!trimmed) return EMPTY_NAME;

  await connectDB();
  try {
    const folder = await Folder.create({
      userId: user.userId,
      name: trimmed,
      position: await nextFolderPosition(user.userId),
    });
    return { ok: true, id: folder._id.toString() };
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_NAME;
    throw error;
  }
}

export async function renameFolder(
  id: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  const trimmed = name.trim();
  if (!trimmed) return EMPTY_NAME;

  await connectDB();
  try {
    const folder = await Folder.findOneAndUpdate(
      { _id: id, userId: user.userId, deletedAt: null },
      { $set: { name: trimmed } },
      { projection: { name: 1, published: 1 } },
    ).lean();
    if (!folder) return NOT_FOUND;
    if (folder.published && folder.name !== trimmed) {
      await rememberFolderSlug(id, user.userId, folder.name);
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) return DUPLICATE_NAME;
    throw error;
  }

  refresh();
  return { ok: true };
}

// Deletes the chapters too, without touching their updatedAt (like any organizational change).
export async function deleteFolder(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const deletedAt = new Date();
  const { matchedCount } = await Folder.updateOne(
    { _id: id, userId: user.userId, deletedAt: null },
    { $set: { deletedAt } },
  );
  if (matchedCount === 0) return NOT_FOUND;
  await Story.updateMany(
    { userId: user.userId, folderId: id, deletedAt: null },
    { $set: { deletedAt } },
    { timestamps: false },
  );

  return { ok: true };
}

export async function saveFolderNotes(
  id: string,
  notes: string,
  expectedNotesUpdatedAt: string,
): Promise<ActionResult<{ notesUpdatedAt: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const expected = new Date(expectedNotesUpdatedAt);
  // Strictly later than expected, so a parallel save with the same expected value cannot match.
  const notesUpdatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  const { matchedCount } = await Folder.updateOne(
    { ...owned, notesUpdatedAt: expected },
    { $set: { notes, notesUpdatedAt, lastActivityAt: notesUpdatedAt } },
  );
  if (matchedCount === 1) {
    return { ok: true, notesUpdatedAt: notesUpdatedAt.toISOString() };
  }

  if (!(await Folder.exists(owned))) return NOT_FOUND;
  return {
    ok: false,
    error: "CONFLICT",
    message:
      "These notes were changed in another tab or on another device. Reload the page to get the latest version.",
  };
}

// Organizational change: keeps updatedAt, lastActivityAt and notesUpdatedAt (D36).
export async function setFolderTags(
  id: string,
  tags: string[],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  const normalized = normalizeTags(tags);
  if (!normalized.ok) return normalized;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  if (!(await Folder.exists(owned))) return NOT_FOUND;
  const chapters = await Story.find({
    userId: user.userId,
    folderId: id,
    deletedAt: null,
  })
    .select({ title: 1, tags: 1 })
    .lean();
  const over = chapters.find((chapter) =>
    exceedsTagLimit(chapter.tags, normalized.tags),
  );
  if (over) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: `"${over.title}" would have more than ${MAX_TAGS} tags, counting the ones from this folder.`,
    };
  }
  const { matchedCount } = await Folder.updateOne(
    owned,
    { $set: { tags: normalized.tags } },
    { timestamps: false },
  );
  if (matchedCount === 0) return NOT_FOUND;

  refresh();
  return { ok: true };
}

// Sort changes are organizational: they keep lastActivityAt, updatedAt and notesUpdatedAt.
export async function setFolderSort(mode: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isFolderSort(mode)) return INVALID_INPUT;

  await connectDB();
  const { folders } = await getUserSettings(user.userId);
  if (mode === "manual" && !folders.manualOrder) {
    const shown = await findFoldersInOrder(
      user.userId,
      folderOrder(folders.sort),
    )
      .select({ position: 1 })
      .lean();
    await savePositions(Folder, shown);
  }
  await updateUserSettings(user.userId, {
    folders: { sort: mode, ...(mode === "manual" && { manualOrder: true }) },
  });

  refresh();
  return { ok: true };
}

export async function setChapterSort(
  id: string,
  mode: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  if (!isChapterSort(mode)) return INVALID_INPUT;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const folder = await Folder.findOne(owned)
    .select({ chapterSort: 1, manualChapterOrder: 1 })
    .lean();
  if (!folder) return NOT_FOUND;
  if (mode === "manual" && !folder.manualChapterOrder) {
    const shown = await findChaptersInOrder(
      user.userId,
      id,
      chapterOrder(folder.chapterSort ?? "created"),
    )
      .select({ position: 1 })
      .lean();
    await savePositions(Story, shown);
  }
  await Folder.updateOne(
    owned,
    {
      $set: {
        chapterSort: mode,
        ...(mode === "manual" && { manualChapterOrder: true }),
      },
    },
    { timestamps: false },
  );

  refresh();
  return { ok: true };
}

export async function reorderFolder(
  id: string,
  direction: Direction,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;
  if (!isDirection(direction)) return INVALID_INPUT;

  await connectDB();
  const folders = await findFoldersInOrder(user.userId, folderOrder("manual"))
    .select({ position: 1 })
    .lean();
  const moved = moveInList(folders, id, direction);
  if (!moved) return NOT_FOUND;
  await savePositions(Folder, moved);

  refresh();
  return { ok: true };
}

// Organizational change, like tags. Chapters keep their explicit state, so unpublishing and
// publishing again brings back the same set.
export async function setFolderPublished(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const folder = await Folder.findOne(owned).select({ published: 1 }).lean();
  if (!folder) return NOT_FOUND;
  if (enabled && !folder.published) {
    await Story.updateMany(
      {
        userId: user.userId,
        folderId: id,
        deletedAt: null,
        publication: { $exists: false },
      },
      { $set: { publication: "public" } },
      { timestamps: false },
    );
  }
  await Folder.updateOne(
    owned,
    { $set: { published: enabled } },
    { timestamps: false },
  );

  refresh();
  return { ok: true };
}

export async function publishAllChapters(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  if (!(await Folder.exists({ ...owned, published: true }))) return NOT_FOUND;
  await Story.updateMany(
    { userId: user.userId, folderId: id, deletedAt: null },
    { $set: { publication: "public" } },
    { timestamps: false },
  );

  refresh();
  return { ok: true };
}
