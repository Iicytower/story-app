"use server";

import { refresh } from "next/cache";
import type { Types } from "mongoose";
import { isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { Rating } from "@/lib/models/rating";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { notifyLater } from "@/lib/social/notify";
import { canInteract } from "@/lib/social/permissions";
import {
  isRatingTarget,
  isRatingValue,
  type RatingTarget,
} from "@/lib/social/ratings";
import { findVisibleFolder, findVisibleStory } from "@/lib/social/visibility";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");

interface Target {
  authorId: Types.ObjectId;
  folderId: Types.ObjectId;
  storyId: Types.ObjectId | null;
}

// A public chapter or book (D38) visible to the reader.
async function findTarget(
  userId: string,
  targetType: RatingTarget,
  targetId: string,
): Promise<Target | null> {
  if (targetType === "story") {
    const story = await findVisibleStory(userId, targetId);
    return (
      story && {
        authorId: story.userId,
        folderId: story.folderId,
        storyId: story._id,
      }
    );
  }
  const folder = await findVisibleFolder(userId, targetId);
  return (
    folder && { authorId: folder.userId, folderId: folder._id, storyId: null }
  );
}

// Session, input and the limit. Ratings are anonymous, so an account without a nickname rates
// too.
async function start(
  targetType: unknown,
  targetId: unknown,
  valid = true,
): Promise<ActionResult<{ userId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!valid || !isRatingTarget(targetType) || !isId(targetId)) {
    return invalid();
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.rate, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  return { ok: true, userId: user.userId };
}

// Visibility, one's own text and bans and blocks with the author (D80).
async function check(
  targetType: unknown,
  targetId: unknown,
  valid: boolean,
): Promise<ActionResult<{ userId: string; target: Target }>> {
  const user = await start(targetType, targetId, valid);
  if (!user.ok) return user;
  const target = await findTarget(
    user.userId,
    targetType as RatingTarget,
    targetId as string,
  );
  if (!target) return actionError("NOT_FOUND", "ratingTargetNotFound");
  // canInteract lets anyone act on their own content: an author does not rate their text.
  if (target.authorId.equals(user.userId)) {
    return actionError("FORBIDDEN", "interactionNotAllowed");
  }
  const permission = await canInteract(user.userId, {
    authorId: target.authorId.toString(),
    kind: "rate",
  });
  if (!permission.ok) return translateError(permission);
  return { ok: true, userId: user.userId, target };
}

// Sets the reader's one rating of the chapter or book, replacing an earlier one (D80).
export async function rate(
  targetType: RatingTarget,
  targetId: string,
  value: number,
): Promise<ActionResult<{ value: number }>> {
  const checked = await check(targetType, targetId, isRatingValue(value));
  if (!checked.ok) return checked;
  const { userId, target } = checked;
  const key = { userId, targetType, targetId };
  // The same value again changes nothing, so it keeps its date.
  const changed = { ...key, value: { $ne: value } };
  const update = {
    $set: {
      value,
      authorId: target.authorId,
      folderId: target.folderId,
      storyId: target.storyId,
      updatedAt: new Date(),
    },
  };
  let inserted = false;
  try {
    const result = await Rating.updateOne(changed, update, { upsert: true });
    inserted = result.upsertedCount === 1;
  } catch (error) {
    // The reader already gave this value, or a parallel request inserted a rating first.
    if (!isDuplicateKeyError(error)) throw error;
    await Rating.updateOne(changed, update);
  }
  // Only a new rating, not a changed one; grouped per object and anonymous when shown.
  if (inserted) {
    notifyLater(target.authorId, {
      type: "rating",
      actorId: userId,
      authorId: target.authorId,
      folderId: target.folderId,
      ...(targetType === "story" && { storyIds: [targetId] }),
    });
  }
  // Task 83: the author's statistics count ratings by authorId and updatedAt. Task 84: the
  // "top rated" ranking reads the book's ratings by { targetType: "folder", targetId }.
  refresh();
  return { ok: true, value };
}

// One's own anonymous rating can always go: after a ban, a block or the text going private too.
export async function removeRating(
  targetType: RatingTarget,
  targetId: string,
): Promise<ActionResult> {
  const user = await start(targetType, targetId);
  if (!user.ok) return user;
  await Rating.deleteOne({ userId: user.userId, targetType, targetId });
  refresh();
  return { ok: true };
}
