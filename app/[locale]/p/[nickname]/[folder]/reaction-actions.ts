"use server";

import { refresh } from "next/cache";
import type { Types } from "mongoose";
import { isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { Comment } from "@/lib/models/comment";
import { Reaction } from "@/lib/models/reaction";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { canInteract, hiddenUserIdsFor } from "@/lib/social/permissions";
import {
  isReaction,
  type ReactionKey,
  type ReactionTarget,
} from "@/lib/social/reactions";
import { findVisibleFolder, findVisibleStory } from "@/lib/social/visibility";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const notFound = () => actionError("NOT_FOUND", "reactionTargetNotFound");
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");

interface Target {
  authorId: Types.ObjectId;
  // Who wrote a comment, when it is not the text's author.
  writerId: Types.ObjectId | null;
  folderId: Types.ObjectId;
  storyId: Types.ObjectId | null;
}

// A public chapter (D38) visible to the reader.
async function storyTarget(
  userId: string,
  storyId: string,
): Promise<Target | null> {
  const story = await findVisibleStory(userId, storyId);
  if (!story) return null;
  return {
    authorId: story.userId,
    writerId: null,
    folderId: story.folderId,
    storyId: story._id,
  };
}

// A comment the reader sees as one (task 76): not deleted or hidden, comments on, its place
// public, and neither it nor its thread written by an account hidden from the reader.
async function commentTarget(
  userId: string,
  commentId: string,
): Promise<Target | null> {
  await connectDB();
  const comment = await Comment.findOne({
    _id: commentId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ userId: 1, parentId: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!comment) return null;
  const [place, root, hidden, named] = await Promise.all([
    comment.storyId
      ? findVisibleStory(userId, comment.storyId.toString())
      : findVisibleFolder(userId, comment.folderId.toString()),
    comment.parentId
      ? Comment.findById(comment.parentId).select({ userId: 1 }).lean()
      : comment,
    hiddenUserIdsFor(userId),
    User.exists({ _id: comment.userId, nickname: { $type: "string" } }),
  ]);
  if (!place || place.commentsDisabled || !root || !named) return null;
  if (
    hidden.some((id) => id.equals(comment.userId) || id.equals(root.userId))
  ) {
    return null;
  }
  return {
    authorId: place.userId,
    writerId: place.userId.equals(comment.userId) ? null : comment.userId,
    folderId: comment.folderId,
    storyId: comment.storyId,
  };
}

// Bans and blocks against the text's author, and blocks with a comment's writer (D80). Reactions
// are public, so an account without a nickname has no name to show in the list.
async function refusal(userId: string, target: Target) {
  const [named, ...permissions] = await Promise.all([
    User.exists({ _id: userId, nickname: { $type: "string" } }),
    canInteract(userId, {
      authorId: target.authorId.toString(),
      kind: "react",
    }),
    ...(target.writerId
      ? [
          canInteract(userId, {
            authorId: target.writerId.toString(),
            kind: "reply",
          }),
        ]
      : []),
  ]);
  if (!named) return refused();
  for (const permission of permissions) {
    if (!permission.ok) return translateError(permission);
  }
  return null;
}

// Sets the reader's one reaction to the object, replacing another; null takes it off (D80).
// Clicking the chosen one again sends null.
export async function react(
  targetType: ReactionTarget,
  targetId: string,
  reaction: ReactionKey | null,
): Promise<ActionResult<{ reaction: ReactionKey | null }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  // Forum posts join in task 87.
  if (targetType !== "story" && targetType !== "comment") return invalid();
  if (!isId(targetId) || (reaction !== null && !isReaction(reaction))) {
    return invalid();
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.react, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  const target =
    targetType === "story"
      ? await storyTarget(user.userId, targetId)
      : await commentTarget(user.userId, targetId);
  if (!target) return notFound();
  // canInteract lets anyone act on their own content: an author does not react to their text.
  const own = target.writerId ?? target.authorId;
  if (own.equals(user.userId)) return refused();
  const refusedBy = await refusal(user.userId, target);
  if (refusedBy) return refusedBy;

  const key = { userId: user.userId, targetType, targetId };
  if (reaction === null) {
    await Reaction.deleteOne(key);
    refresh();
    return { ok: true, reaction: null };
  }
  // The same reaction again changes nothing, so it keeps its date.
  const changed = { ...key, reaction: { $ne: reaction } };
  const update = {
    $set: {
      reaction,
      authorId: target.authorId,
      folderId: target.folderId,
      storyId: target.storyId,
      createdAt: new Date(),
    },
  };
  try {
    await Reaction.updateOne(changed, update, { upsert: true });
  } catch (error) {
    // The reader already has this reaction, or a parallel request inserted another one first.
    if (!isDuplicateKeyError(error)) throw error;
    await Reaction.updateOne(changed, update);
  }
  // A comment deleted meanwhile has taken its reactions with it already (deleteComment).
  if (
    targetType === "comment" &&
    !(await Comment.exists({
      _id: targetId,
      deletedAt: null,
      hidden: { $exists: false },
    }))
  ) {
    await Reaction.deleteOne(key);
    return notFound();
  }
  // Task 81: notify the text's or comment's author, grouped per object (a new reaction is the
  // upsert's upsertedCount, a changed one is not). Task 83: the author's statistics count
  // reactions by authorId and createdAt.
  refresh();
  return { ok: true, reaction };
}
