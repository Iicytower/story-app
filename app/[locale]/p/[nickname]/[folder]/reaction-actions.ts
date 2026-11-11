"use server";

import { refresh } from "next/cache";
import { Types } from "mongoose";
import { isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { Comment } from "@/lib/models/comment";
import { ForumPost } from "@/lib/models/forum-post";
import { Reaction } from "@/lib/models/reaction";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { findVisiblePost, forumPermission } from "@/lib/social/forums";
import { notifyLater } from "@/lib/social/notify";
import { canInteract } from "@/lib/social/permissions";
import {
  isReaction,
  type ReactionKey,
  type ReactionTarget,
} from "@/lib/social/reactions";
import { findVisibleComment, findVisibleStory } from "@/lib/social/visibility";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const notFound = () => actionError("NOT_FOUND", "reactionTargetNotFound");
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");

interface Target {
  // The text's owner or the author of the forum; null in a global forum category.
  authorId: Types.ObjectId | null;
  // Who wrote a comment or post, when it is not the text's author.
  writerId: Types.ObjectId | null;
  folderId: Types.ObjectId | null;
  storyId: Types.ObjectId | null;
  threadId?: Types.ObjectId;
  // A post's forum, whose rules apply instead of the text author's (task 87).
  forum?: NonNullable<Awaited<ReturnType<typeof findVisiblePost>>>["place"];
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

async function commentTarget(
  userId: string,
  commentId: string,
): Promise<Target | null> {
  const comment = await findVisibleComment(userId, commentId);
  if (!comment) return null;
  return {
    authorId: comment.authorId,
    writerId: comment.authorId.equals(comment.writerId)
      ? null
      : comment.writerId,
    folderId: comment.folderId,
    storyId: comment.storyId,
  };
}

// A forum post (task 87): no book or chapter; the author is the forum's owner.
async function postTarget(
  userId: string,
  postId: string,
): Promise<Target | null> {
  const post = await findVisiblePost(userId, postId);
  if (!post) return null;
  return {
    authorId:
      post.place.scope === "author"
        ? new Types.ObjectId(post.place.authorId)
        : null,
    writerId: post.writerId,
    folderId: null,
    storyId: null,
    threadId: post.threadId,
    forum: post.place,
  };
}

// Bans and blocks against the text's author, and blocks with a comment's writer (D80). Reactions
// are public, so an account without a nickname has no name to show in the list.
async function refusal(userId: string, target: Target) {
  if (target.forum) {
    const [named, permission] = await Promise.all([
      User.exists({ _id: userId, nickname: { $type: "string" } }),
      forumPermission(userId, target.forum, "react", [target.writerId!]),
    ]);
    if (!named) return refused();
    return permission.ok ? null : translateError(permission);
  }
  const [named, ...permissions] = await Promise.all([
    User.exists({ _id: userId, nickname: { $type: "string" } }),
    canInteract(userId, {
      authorId: target.authorId!.toString(),
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
  if (
    targetType !== "story" &&
    targetType !== "comment" &&
    targetType !== "post"
  ) {
    return invalid();
  }
  if (!isId(targetId) || (reaction !== null && !isReaction(reaction))) {
    return invalid();
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.react, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  const target =
    targetType === "story"
      ? await storyTarget(user.userId, targetId)
      : targetType === "comment"
        ? await commentTarget(user.userId, targetId)
        : await postTarget(user.userId, targetId);
  if (!target) return notFound();
  // canInteract lets anyone act on their own content: an author does not react to their text.
  const own = (target.writerId ?? target.authorId)!;
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
  let inserted = false;
  try {
    const result = await Reaction.updateOne(changed, update, { upsert: true });
    inserted = result.upsertedCount === 1;
  } catch (error) {
    // The reader already has this reaction, or a parallel request inserted another one first.
    if (!isDuplicateKeyError(error)) throw error;
    await Reaction.updateOne(changed, update);
  }
  // A comment or post deleted meanwhile has taken its reactions with it already.
  const gone =
    targetType === "comment"
      ? !(await Comment.exists({
          _id: targetId,
          deletedAt: null,
          hidden: { $exists: false },
        }))
      : targetType === "post" &&
        !(await ForumPost.exists({
          _id: targetId,
          deletedAt: null,
          hidden: { $exists: false },
        }));
  if (gone) {
    await Reaction.deleteOne(key);
    return notFound();
  }
  // Only a new reaction, not a changed one; grouped per object.
  if (inserted) {
    notifyLater(own, {
      type: "reaction",
      actorId: user.userId,
      ...(target.authorId && { authorId: target.authorId }),
      ...(target.folderId && { folderId: target.folderId }),
      ...(target.storyId && { storyIds: [target.storyId] }),
      ...(targetType === "comment" && { commentId: targetId }),
      ...(target.threadId && { threadId: target.threadId, postId: targetId }),
    });
  }
  // Task 83: the author's statistics count reactions by authorId and createdAt.
  refresh();
  return { ok: true, reaction };
}
