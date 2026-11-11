"use server";

import { refresh } from "next/cache";
import type { Types } from "mongoose";
import { isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { lengthError } from "@/lib/limits";
import { Activity } from "@/lib/models/activity";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import { Reaction } from "@/lib/models/reaction";
import { ThreadFollow } from "@/lib/models/thread-follow";
import { User } from "@/lib/models/user";
import {
  giveBackAttempt,
  SOCIAL_LIMITS,
  takeUserAttempt,
} from "@/lib/rate-limit";
import { recordActivity } from "@/lib/social/activity";
import {
  findAuthorForum,
  findCategoryPlace,
  findVisiblePost,
  findVisibleThread,
  type ForumPlace,
  forumPermission,
  POST_EDIT_MS,
  threadReplyRecipients,
} from "@/lib/social/forums";
import { mentionRecipients } from "@/lib/social/mentions";
import { notifyLater } from "@/lib/social/notify";
import { canInteract, isAdmin } from "@/lib/social/permissions";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");
const forumNotFound = () => actionError("NOT_FOUND", "forumNotFound");
const threadNotFound = () => actionError("NOT_FOUND", "threadNotFound");
const postNotFound = () => actionError("NOT_FOUND", "postNotFound");

export type ForumRef = { category: string } | { nickname: string };

function parseForum(value: unknown): ForumRef | null {
  if (typeof value !== "object" || value === null) return null;
  if ("category" in value && isString(value.category)) {
    return { category: value.category };
  }
  if ("nickname" in value && isString(value.nickname)) {
    return { nickname: value.nickname };
  }
  return null;
}

async function postBody(value: unknown): Promise<string | ActionError> {
  if (!isString(value)) return invalid();
  const body = value.trim();
  if (!body) return actionError("INVALID_INPUT", "postRequired");
  const tooLong = lengthError("post", body);
  return tooLong ? translateError(tooLong) : body;
}

async function threadTitle(value: unknown): Promise<string | ActionError> {
  if (!isString(value)) return invalid();
  const title = value.trim();
  if (!title) return actionError("INVALID_INPUT", "threadTitleRequired");
  const tooLong = lengthError("threadTitle", title);
  return tooLong ? translateError(tooLong) : title;
}

// Both limits count; a refusal of the minute one gives the day's attempt back (D80, task 69).
async function takePostAttempt(userId: string): Promise<boolean> {
  const day = await takeUserAttempt(SOCIAL_LIMITS.postDay, userId);
  if (!day) return false;
  if (await takeUserAttempt(SOCIAL_LIMITS.postMinute, userId)) return true;
  await giveBackAttempt(day);
  return false;
}

// A post is public, so it needs a nickname to sign it; in an admin-only category only an admin
// writes (D80: announcements).
async function writerError(
  userId: string,
  place: ForumPlace,
): Promise<ActionError | null> {
  const user = await User.findById(userId)
    .select({ nickname: 1, role: 1 })
    .lean();
  if (!user?.nickname) return refused();
  if (place.scope === "global" && place.category.adminOnly && !isAdmin(user)) {
    return refused();
  }
  return null;
}

async function permissionError(
  userId: string,
  place: ForumPlace,
  repliedTo: (string | Types.ObjectId)[],
): Promise<ActionError | null> {
  const writer = await writerError(userId, place);
  if (writer) return writer;
  const permission = await forumPermission(
    userId,
    place,
    "forumPost",
    repliedTo,
  );
  return permission.ok ? null : translateError(permission);
}

async function findForum(
  userId: string,
  forum: ForumRef,
): Promise<ForumPlace | null> {
  return "category" in forum
    ? findCategoryPlace(forum.category)
    : findAuthorForum(userId, forum.nickname);
}

// The community of an author's forum, for notifications; none for a global category.
const communityOf = (place: ForumPlace) =>
  place.scope === "author" ? { authorId: place.authorId } : {};

export async function createThread(
  forum: ForumRef,
  title: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const target = parseForum(forum);
  if (!target) return invalid();
  const heading = await threadTitle(title);
  if (!isString(heading)) return heading;
  const text = await postBody(body);
  if (!isString(text)) return text;
  if (!(await takeUserAttempt(SOCIAL_LIMITS.threadDay, user.userId))) {
    return rateLimited();
  }
  await connectDB();
  const place = await findForum(user.userId, target);
  if (!place) return forumNotFound();
  const refusal = await permissionError(user.userId, place, []);
  if (refusal) return refusal;

  const now = new Date();
  const thread = await ForumThread.create({
    scope: place.scope,
    ...(place.scope === "global"
      ? { categoryId: place.category.key }
      : { authorId: place.authorId }),
    userId: user.userId,
    title: heading,
    lastPostAt: now,
    postCount: 1,
  });
  const post = await ForumPost.create({
    threadId: thread._id,
    userId: user.userId,
    body: text,
  });
  // The starter follows the thread, so replies reach them.
  await ThreadFollow.create({ userId: user.userId, threadId: thread._id });
  if (place.scope === "author" && place.authorId === user.userId) {
    await recordActivity({
      actorId: user.userId,
      type: "forumThread",
      threadId: thread._id,
    });
  }
  notifyLater(() => mentionRecipients(user.userId, text), {
    type: "mention",
    actorId: user.userId,
    ...communityOf(place),
    threadId: thread._id,
    postId: post._id,
  });
  refresh();
  return { ok: true, id: thread._id.toString() };
}

async function writePost(
  userId: string,
  threadId: string,
  text: string,
  quotePostId: string | null,
): Promise<ActionResult<{ id: string }>> {
  const found = await findVisibleThread(userId, threadId);
  if (!found || found.thread.hidden) return threadNotFound();
  const { thread, place } = found;
  // Only the reference is kept: the quoted text is read with its own visibility (task 87).
  let quote: { _id: Types.ObjectId; userId: Types.ObjectId } | null = null;
  if (quotePostId) {
    const quoted = await findVisiblePost(userId, quotePostId);
    if (!quoted || !quoted.threadId.equals(thread._id)) return postNotFound();
    quote = { _id: quoted._id, userId: quoted.writerId };
  }
  const refusal = await permissionError(userId, place, [
    thread.userId,
    ...(quote ? [quote.userId] : []),
  ]);
  if (refusal) return refusal;

  const post = await ForumPost.create({
    threadId: thread._id,
    userId,
    body: text,
    ...(quote && { quotePostId: quote._id }),
  });
  await ForumThread.updateOne(
    { _id: thread._id },
    { $inc: { postCount: 1 }, $max: { lastPostAt: post.createdAt } },
  );
  const event = {
    actorId: userId,
    ...communityOf(place),
    threadId: thread._id,
    postId: post._id,
  };
  if (quote) notifyLater(quote.userId, { ...event, type: "quote" });
  const quoted = quote ? [quote.userId] : [];
  // One read of the followers for both notifications, after the response.
  let pending: Promise<Types.ObjectId[]> | null = null;
  const followers = () =>
    (pending ??= threadReplyRecipients(thread._id, quoted));
  // notify writes in batches of NOTIFY_BATCH, however many follow the thread.
  notifyLater(followers, { ...event, type: "threadReply" });
  notifyLater(
    async () =>
      mentionRecipients(userId, text, {
        exclude: [...quoted, ...(await followers())],
      }),
    { ...event, type: "mention" },
  );
  refresh();
  return { ok: true, id: post._id.toString() };
}

export async function createPost(
  threadId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(threadId)) return invalid();
  const text = await postBody(body);
  if (!isString(text)) return text;
  if (!(await takePostAttempt(user.userId))) return rateLimited();
  return writePost(user.userId, threadId, text, null);
}

// A reply that quotes postId in its thread; the quoted writer is notified (D80).
export async function quotePost(
  postId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(postId)) return invalid();
  const text = await postBody(body);
  if (!isString(text)) return text;
  if (!(await takePostAttempt(user.userId))) return rateLimited();
  await connectDB();
  const quoted = await ForumPost.findById(postId)
    .select({ threadId: 1 })
    .lean();
  if (!quoted) return postNotFound();
  return writePost(user.userId, quoted.threadId.toString(), text, postId);
}

// Only the writer, within POST_EDIT_MS of posting (D80); afterwards it can only be deleted.
export async function editPost(
  postId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(postId)) return invalid();
  await connectDB();
  const post = await ForumPost.findOne({
    _id: postId,
    userId: user.userId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ createdAt: 1, threadId: 1, body: 1, quotePostId: 1 })
    .lean();
  if (!post) return postNotFound();
  if (Date.now() - post.createdAt.getTime() > POST_EDIT_MS) {
    return actionError("FORBIDDEN", "postEditExpired");
  }
  const text = await postBody(body);
  if (!isString(text)) return text;
  if (!(await takePostAttempt(user.userId))) return rateLimited();
  const found = await findVisibleThread(user.userId, post.threadId.toString());
  if (!found || found.thread.hidden) return threadNotFound();
  const quoted = post.quotePostId
    ? await ForumPost.findById(post.quotePostId).select({ userId: 1 }).lean()
    : null;
  const refusal = await permissionError(user.userId, found.place, [
    found.thread.userId,
    ...(quoted ? [quoted.userId] : []),
  ]);
  if (refusal) return refusal;

  const { matchedCount } = await ForumPost.updateOne(
    {
      _id: post._id,
      userId: user.userId,
      deletedAt: null,
      hidden: { $exists: false },
    },
    { $set: { body: text, editedAt: new Date() } },
  );
  if (matchedCount === 0) return postNotFound();
  notifyLater(
    () =>
      mentionRecipients(user.userId, text, {
        previous: post.body,
        postId: post._id,
      }),
    {
      type: "mention",
      actorId: user.userId,
      ...communityOf(found.place),
      threadId: post.threadId,
      postId: post._id,
    },
  );
  refresh();
  return { ok: true };
}

// The writer can always delete (D80), also after a ban or a block and when hidden. The thread's
// first post is its text: with other posts after it, it stays as "post deleted"; alone, the thread
// goes with it.
export async function deletePost(postId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(postId)) return invalid();
  await connectDB();
  const post = await ForumPost.findOne({
    _id: postId,
    userId: user.userId,
    deletedAt: null,
  })
    .select({ threadId: 1 })
    .lean();
  if (!post) return postNotFound();
  const first = await ForumPost.findOne({ threadId: post.threadId })
    .sort({ createdAt: 1, _id: 1 })
    .select({ _id: 1, deletedAt: 1 })
    .lean();
  const isFirst = first?._id.equals(post._id) ?? false;

  await Reaction.deleteMany({ targetType: "post", targetId: post._id });
  if (isFirst) {
    // Alone in its thread: the thread goes, unless a reply landed meanwhile (postCount).
    if (await closeThread(post.threadId, 1)) {
      await ForumPost.deleteOne({ _id: post._id });
    } else {
      await ForumPost.updateOne(
        { _id: post._id },
        { $set: { deletedAt: new Date(), body: "" }, $unset: { editedAt: 1 } },
      );
    }
  } else {
    await ForumPost.deleteOne({ _id: post._id });
    await ForumThread.updateOne(
      { _id: post.threadId },
      { $inc: { postCount: -1 } },
    );
    // Only the placeholder of the first post is left: nothing of the thread remains to read.
    if (first?.deletedAt) await closeThread(post.threadId, 1);
  }
  refresh();
  return { ok: true };
}

// Soft-deletes the thread while it has exactly postCount posts, placeholders included.
async function closeThread(
  threadId: Types.ObjectId,
  postCount: number,
): Promise<boolean> {
  const { modifiedCount } = await ForumThread.updateOne(
    { _id: threadId, postCount, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (modifiedCount === 0) return false;
  await Promise.all([
    ThreadFollow.deleteMany({ threadId }),
    Activity.deleteMany({ threadId }),
  ]);
  return true;
}

// Following a thread is not taking part in a community, so a community ban does not stop it; a
// global ban does (D80: no social activity).
async function setFollow(
  threadId: unknown,
  followed: boolean,
): Promise<ActionResult<{ followed: boolean }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(threadId)) return invalid();
  if (!(await takeUserAttempt(SOCIAL_LIMITS.follow, user.userId))) {
    return rateLimited();
  }
  await connectDB();
  if (!followed) {
    await ThreadFollow.deleteOne({ userId: user.userId, threadId });
    refresh();
    return { ok: true, followed: false };
  }
  const found = await findVisibleThread(user.userId, threadId);
  if (!found || found.thread.hidden) return threadNotFound();
  const permission = await canInteract(user.userId, {
    authorId: user.userId,
    kind: "follow",
  });
  if (!permission.ok) return translateError(permission);
  try {
    await ThreadFollow.create({ userId: user.userId, threadId });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  refresh();
  return { ok: true, followed: true };
}

export async function followThread(threadId: string) {
  return setFollow(threadId, true);
}

export async function unfollowThread(threadId: string) {
  return setFollow(threadId, false);
}
