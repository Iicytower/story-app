"use server";

import { randomBytes } from "node:crypto";
import { isObjectIdOrHexString } from "mongoose";
import { revalidatePath } from "next/cache";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { Story } from "@/lib/models/story";

const NOT_FOUND: ActionError = {
  ok: false,
  error: "NOT_FOUND",
  message: "This story does not exist or has been deleted.",
};

export async function createStory(
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;

  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "EMPTY_TITLE", message: "Title is required." };
  }

  await connectDB();
  try {
    const story = await Story.create({ userId: user.userId, title: trimmed });
    return { ok: true, id: story._id.toString() };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        ok: false,
        error: "DUPLICATE_TITLE",
        message: "A story with this title already exists.",
      };
    }
    throw error;
  }
}

export async function deleteStory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const { matchedCount } = await Story.updateOne(
    { _id: id, userId: user.userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (matchedCount === 0) return NOT_FOUND;

  revalidatePath("/stories");
  return { ok: true };
}

export async function saveStory(
  id: string,
  title: string,
  content: string,
  notes: string,
  expectedUpdatedAt: string,
): Promise<ActionResult<{ updatedAt: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "EMPTY_TITLE", message: "Title is required." };
  }

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  const expected = new Date(expectedUpdatedAt);
  // Strictly later than expected, so a parallel save with the same expectedUpdatedAt cannot match.
  const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  try {
    // Conflict and empty-content checks live in the filter to make them atomic with the write.
    const { matchedCount } = await Story.updateOne(
      {
        ...owned,
        updatedAt: expected,
        ...(!content.trim() && { content: /^\s*$/ }),
      },
      { $set: { title: trimmed, content, notes, updatedAt } },
      { timestamps: false },
    );
    if (matchedCount === 1) {
      return { ok: true, updatedAt: updatedAt.toISOString() };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        ok: false,
        error: "DUPLICATE_TITLE",
        message: "A story with this title already exists.",
      };
    }
    throw error;
  }

  const current = await Story.findOne(owned).select({ updatedAt: 1 }).lean();
  if (!current) return NOT_FOUND;
  if (current.updatedAt.getTime() !== expected.getTime()) {
    return {
      ok: false,
      error: "CONFLICT",
      message:
        "This story was changed in another tab or on another device. Reload the page to get the latest version.",
    };
  }
  return {
    ok: false,
    error: "EMPTY_CONTENT",
    message:
      "The story content cannot be cleared completely. Your changes were not saved.",
  };
}

// Sharing does not touch updatedAt: an open editor sends it as expectedUpdatedAt on the next save.
export async function setSharing(
  id: string,
  enabled: boolean,
): Promise<ActionResult<{ sharePath: string | null }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isObjectIdOrHexString(id)) return NOT_FOUND;

  await connectDB();
  const owned = { _id: id, userId: user.userId, deletedAt: null };
  if (!enabled) {
    const { matchedCount } = await Story.updateOne(
      owned,
      { $unset: { shareToken: 1 } },
      { timestamps: false },
    );
    return matchedCount === 0 ? NOT_FOUND : { ok: true, sharePath: null };
  }

  // Keeps an existing token, so sharing twice (e.g. from two tabs) returns the same link.
  await Story.updateOne(
    { ...owned, shareToken: { $exists: false } },
    { $set: { shareToken: randomBytes(16).toString("base64url") } },
    { timestamps: false },
  );
  const story = await Story.findOne(owned).select({ shareToken: 1 }).lean();
  if (!story?.shareToken) return NOT_FOUND;
  return { ok: true, sharePath: `/s/${story.shareToken}` };
}
