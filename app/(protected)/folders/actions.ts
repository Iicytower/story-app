"use server";

import { isObjectIdOrHexString } from "mongoose";
import { refresh } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";

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
    const folder = await Folder.create({ userId: user.userId, name: trimmed });
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
    const { matchedCount } = await Folder.updateOne(
      { _id: id, userId: user.userId, deletedAt: null },
      { $set: { name: trimmed } },
    );
    if (matchedCount === 0) return NOT_FOUND;
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
