"use server";

import { refresh } from "next/cache";
import { Types } from "mongoose";
import { isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { lengthError } from "@/lib/limits";
import { Activity } from "@/lib/models/activity";
import { Comment } from "@/lib/models/comment";
import { Reaction } from "@/lib/models/reaction";
import { User } from "@/lib/models/user";
import {
  giveBackAttempt,
  SOCIAL_LIMITS,
  takeUserAttempt,
} from "@/lib/rate-limit";
import { recordActivity } from "@/lib/social/activity";
import { COMMENT_EDIT_MS } from "@/lib/social/comments";
import { canInteract, type Permission } from "@/lib/social/permissions";
import { findVisibleFolder, findVisibleStory } from "@/lib/social/visibility";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");
const targetNotFound = () => actionError("NOT_FOUND", "commentTargetNotFound");
const commentNotFound = () => actionError("NOT_FOUND", "commentNotFound");
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");

type Target = {
  folderId: Types.ObjectId;
  storyId: Types.ObjectId | null;
  authorId: Types.ObjectId;
};

// A trimmed, non-empty body within MAX_COMMENT_LENGTH, or the error to return.
async function commentBody(value: unknown): Promise<string | ActionError> {
  if (!isString(value)) return invalid();
  const body = value.trim();
  if (!body) return actionError("INVALID_INPUT", "commentRequired");
  const tooLong = lengthError("comment", body);
  return tooLong ? translateError(tooLong) : body;
}

// Both limits count; a refusal of the minute one gives the day's attempt back (D80, task 69).
async function takeCommentAttempt(userId: string): Promise<boolean> {
  const day = await takeUserAttempt(SOCIAL_LIMITS.commentDay, userId);
  if (!day) return false;
  if (await takeUserAttempt(SOCIAL_LIMITS.commentMinute, userId)) return true;
  await giveBackAttempt(day);
  return false;
}

// D38 at write time: a comment needs its chapter or book public, visible to the writer and with
// comments on. Ids come from the database, never from the client.
async function findTarget(
  userId: string,
  place: Place,
): Promise<Target | ActionError> {
  if ("storyId" in place) {
    const story = await findVisibleStory(userId, place.storyId);
    if (!story) return targetNotFound();
    if (story.commentsDisabled) {
      return actionError("FORBIDDEN", "commentsDisabled");
    }
    return {
      folderId: story.folderId,
      storyId: story._id,
      authorId: story.userId,
    };
  }
  const folder = await findVisibleFolder(userId, place.folderId);
  if (!folder) return targetNotFound();
  if (folder.commentsDisabled) {
    return actionError("FORBIDDEN", "commentsDisabled");
  }
  return { folderId: folder._id, storyId: null, authorId: folder.userId };
}

async function permissionError(
  permission: Permission,
): Promise<ActionError | null> {
  return permission.ok ? null : translateError(permission);
}

// Bans and blocks against the text's author (D80); an account without a nickname has no public
// name to sign a comment with.
async function interactionError(
  userId: string,
  authorId: Types.ObjectId,
): Promise<ActionError | null> {
  const [named, permission] = await Promise.all([
    User.exists({ _id: userId, nickname: { $type: "string" } }),
    canInteract(userId, { authorId: authorId.toString(), kind: "comment" }),
  ]);
  if (!named) return refused();
  return permissionError(permission);
}

const placeOf = (comment: {
  storyId: Types.ObjectId | null;
  folderId: Types.ObjectId;
}) =>
  comment.storyId
    ? { storyId: comment.storyId.toString() }
    : { folderId: comment.folderId.toString() };

type Place = { storyId: string } | { folderId: string };

function parsePlace(place: unknown): Place | null {
  if (typeof place !== "object" || place === null) return null;
  if ("storyId" in place && isId(place.storyId)) {
    return { storyId: place.storyId };
  }
  if ("folderId" in place && isId(place.folderId)) {
    return { folderId: place.folderId };
  }
  return null;
}

export async function addComment(
  place: Place,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const target = parsePlace(place);
  if (!target) return invalid();
  const text = await commentBody(body);
  if (!isString(text)) return text;
  if (!(await takeCommentAttempt(user.userId))) return rateLimited();
  const found = await findTarget(user.userId, target);
  if ("ok" in found) return found;
  const refusal = await interactionError(user.userId, found.authorId);
  if (refusal) return refusal;

  const comment = await Comment.create({
    ...found,
    userId: user.userId,
    parentId: null,
    body: text,
  });
  // Task 81: notify the text's author. Task 82: mentions in the body.
  refresh();
  return { ok: true, id: comment._id.toString() };
}

// A reply to a reply joins the same top-level comment: one level only (D80).
export async function replyToComment(
  commentId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(commentId)) return invalid();
  const text = await commentBody(body);
  if (!isString(text)) return text;
  if (!(await takeCommentAttempt(user.userId))) return rateLimited();
  await connectDB();
  const parent = await Comment.findOne({
    _id: commentId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ userId: 1, parentId: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!parent) return commentNotFound();
  const root = parent.parentId
    ? await Comment.findById(parent.parentId)
        .select({ userId: 1, folderId: 1, storyId: 1 })
        .lean()
    : parent;
  if (!root) return commentNotFound();
  const target = await findTarget(user.userId, placeOf(root));
  if ("ok" in target) return target;
  const refusal = await interactionError(user.userId, target.authorId);
  if (refusal) return refusal;
  // A block between the writer and the author of the comment replied to, or of its thread.
  const repliedTo = [
    ...new Set([parent.userId.toString(), root.userId.toString()]),
  ].filter((id) => id !== user.userId && !target.authorId.equals(id));
  for (const authorId of repliedTo) {
    const blocked = await permissionError(
      await canInteract(user.userId, { authorId, kind: "reply" }),
    );
    if (blocked) return blocked;
  }

  const reply = await Comment.create({
    ...target,
    userId: user.userId,
    parentId: root._id,
    body: text,
  });
  // The thread's last placeholder may have gone with its last reply meanwhile (deleteComment).
  if (!(await Comment.exists({ _id: root._id }))) {
    await Comment.deleteOne({ _id: reply._id });
    return commentNotFound();
  }
  if (target.authorId.equals(user.userId)) {
    await recordActivity({
      actorId: user.userId,
      type: "authorReply",
      folderId: target.folderId,
      ...(target.storyId && { storyIds: [target.storyId] }),
      commentId: reply._id,
    });
  }
  // Task 81: notify the authors of the comment replied to and of the text. Task 82: mentions.
  refresh();
  return { ok: true, id: reply._id.toString() };
}

// Only the writer, only within COMMENT_EDIT_MS of posting; afterwards it can only be deleted.
export async function editComment(
  commentId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(commentId)) return invalid();
  await connectDB();
  const comment = await Comment.findOne({
    _id: commentId,
    userId: user.userId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ createdAt: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!comment) return commentNotFound();
  if (Date.now() - comment.createdAt.getTime() > COMMENT_EDIT_MS) {
    return actionError("FORBIDDEN", "commentEditExpired");
  }
  const text = await commentBody(body);
  if (!isString(text)) return text;
  if (!(await takeCommentAttempt(user.userId))) return rateLimited();
  const target = await findTarget(user.userId, placeOf(comment));
  if ("ok" in target) return target;
  const refusal = await interactionError(user.userId, target.authorId);
  if (refusal) return refusal;

  const { matchedCount } = await Comment.updateOne(
    {
      _id: comment._id,
      userId: user.userId,
      deletedAt: null,
      hidden: { $exists: false },
    },
    { $set: { body: text, editedAt: new Date() } },
  );
  if (matchedCount === 0) return commentNotFound();
  // Task 82: mentions added by the edit.
  refresh();
  return { ok: true };
}

// The writer can always delete (D80), also after a ban or a block and when hidden. With replies
// the comment stays without its text as "comment deleted".
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(commentId)) return invalid();
  await connectDB();
  const comment = await Comment.findOne({
    _id: commentId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ parentId: 1 })
    .lean();
  if (!comment) return commentNotFound();

  const replies =
    comment.parentId === null &&
    (await Comment.exists({ parentId: comment._id }));
  // A placeholder has no text to react to, so its reactions go as well (task 77).
  await Reaction.deleteMany({ targetType: "comment", targetId: comment._id });
  if (replies) {
    await Comment.updateOne(
      { _id: comment._id },
      { $set: { deletedAt: new Date(), body: "" }, $unset: { editedAt: 1 } },
    );
  } else {
    await Comment.deleteOne({ _id: comment._id });
    await Activity.deleteMany({ commentId: comment._id });
    // The last reply of a deleted comment takes the placeholder with it.
    if (
      comment.parentId &&
      !(await Comment.exists({ parentId: comment.parentId }))
    ) {
      await Comment.deleteOne({
        _id: comment.parentId,
        deletedAt: { $ne: null },
      });
    }
  }
  refresh();
  return { ok: true };
}
