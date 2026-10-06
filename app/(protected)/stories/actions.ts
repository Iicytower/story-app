"use server";

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
