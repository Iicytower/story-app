"use server";

import { Types } from "mongoose";
import { isFraction, isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { Folder } from "@/lib/models/folder";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Story } from "@/lib/models/story";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { isAuthorVisibleTo } from "@/lib/social/permissions";

// Called in the background every few seconds, so it does not refresh the page. A chapter
// scrolled to the end (position 1) is read.
export async function saveReadingPosition(
  storyId: string,
  position: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(storyId) || !isFraction(position)) {
    return actionError("INVALID_INPUT", "requestInvalid");
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.progress, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  await connectDB();
  // The same visibility as the library (D38, task 72): hidden authors' books are not found.
  const story = await Story.findOne({
    _id: storyId,
    publication: "public",
    deletedAt: null,
  })
    .select({ folderId: 1, userId: 1 })
    .lean();
  const visible =
    story &&
    (
      await Promise.all([
        Folder.exists({
          _id: story.folderId,
          userId: story.userId,
          published: true,
          deletedAt: null,
        }),
        isAuthorVisibleTo(user.userId, story.userId),
      ])
    ).every(Boolean);
  if (!story || !visible) {
    return actionError("NOT_FOUND", "storyNotFound");
  }

  const key = {
    userId: new Types.ObjectId(user.userId),
    folderId: story.folderId,
  };
  const save = () =>
    ReadingProgress.updateOne(
      key,
      {
        $set: { lastStoryId: story._id, position },
        ...(position === 1 && { $addToSet: { readStoryIds: story._id } }),
      },
      { upsert: true },
    );
  // Two tabs at once: the other request inserted the entry, so this one updates it.
  await save().catch((error: unknown) => {
    if (!isDuplicateKeyError(error)) throw error;
    return save();
  });
  return { ok: true };
}
