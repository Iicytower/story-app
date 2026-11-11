import type { Types } from "mongoose";
import type { ActionResult } from "@/lib/action-result";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread, HIDDEN_FORUM_TTL_DAYS } from "@/lib/models/forum-thread";
import { Reaction } from "@/lib/models/reaction";
import {
  canModerateForum,
  type ForumPlace,
  forumRole,
  placeOfThread,
} from "@/lib/social/forums";
import { logModeration } from "@/lib/social/moderation";
import { notifyLater } from "@/lib/social/notify";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ForumTarget = "post" | "thread";

const notFound = (type: ForumTarget) =>
  actionError("NOT_FOUND", type === "post" ? "postNotFound" : "threadNotFound");

interface Moderated {
  id: Types.ObjectId;
  threadId: Types.ObjectId;
  writerId: Types.ObjectId;
  hidden: boolean;
  place: ForumPlace;
}

// The forum is the content's own: an author's forum or a category, never the client's (task 79).
// Outside the actor's role it is not found.
async function findModerated(userId: string, type: ForumTarget, id: string) {
  const content =
    type === "post"
      ? await ForumPost.findOne({ _id: id, deletedAt: null })
          .select({ threadId: 1, userId: 1, hidden: 1 })
          .lean()
      : await ForumThread.findOne({ _id: id, deletedAt: null })
          .select({ userId: 1, hidden: 1 })
          .lean();
  if (!content) return null;
  const threadId = "threadId" in content ? content.threadId : content._id;
  const thread = await ForumThread.findOne({ _id: threadId, deletedAt: null })
    .select({ scope: 1, categoryId: 1, authorId: 1 })
    .lean();
  if (!thread) return null;
  const place = await placeOfThread(userId, thread);
  if (!place) return null;
  const role = await forumRole(userId, place);
  if (!role) return null;
  const permission = await canModerateForum(
    userId,
    place,
    role,
    content.userId.toString(),
    "hide",
  );
  const moderated: Moderated = {
    id: content._id,
    threadId,
    writerId: content.userId,
    hidden: Boolean(content.hidden),
    place,
  };
  return { moderated, permission };
}

const community = (place: ForumPlace) =>
  place.scope === "author"
    ? { authorId: place.authorId }
    : { authorId: null, scope: "global" as const };

// Hiding a thread hides its posts with it: they expire together by the same purgeAt, so nothing
// is left of a thread the TTL index removed (D80: gone for good after 30 days).
export async function hideForumContent(
  userId: string,
  type: ForumTarget,
  id: string,
  reason: string | undefined,
): Promise<ActionResult> {
  const found = await findModerated(userId, type, id);
  if (!found) return notFound(type);
  const { moderated, permission } = found;
  if (!permission.ok) return translateError(permission);
  if (moderated.hidden) return { ok: true };

  const now = new Date();
  const purgeAt = new Date(now.getTime() + HIDDEN_FORUM_TTL_DAYS * DAY_MS);
  const hidden = { by: userId, at: now, ...(reason && { reason }) };
  const filter = {
    _id: moderated.id,
    deletedAt: null,
    hidden: { $exists: false },
  };
  const { modifiedCount } =
    type === "post"
      ? await ForumPost.updateOne(filter, { $set: { hidden, purgeAt } })
      : await ForumThread.updateOne(filter, { $set: { hidden, purgeAt } });
  if (modifiedCount === 0) return { ok: true };
  if (type === "post") {
    await Reaction.updateMany(
      { targetType: "post", targetId: moderated.id },
      { $set: { purgeAt } },
    );
  } else {
    await ForumPost.updateMany(
      { threadId: moderated.id, purgeAt: { $exists: false } },
      { $set: { purgeAt } },
    );
    const postIds = (await ForumPost.distinct("_id", {
      threadId: moderated.id,
    })) as Types.ObjectId[];
    await Reaction.updateMany(
      {
        targetType: "post",
        targetId: { $in: postIds },
        purgeAt: { $exists: false },
      },
      { $set: { purgeAt } },
    );
  }
  await logModeration({
    ...community(moderated.place),
    actorId: userId,
    action: "hide",
    targetType: type,
    targetId: moderated.id,
    targetUserId: moderated.writerId,
    ...(reason && { reason }),
  });
  notifyLater(moderated.writerId, {
    type: "hidden",
    actorId: userId,
    ...(moderated.place.scope === "author" && {
      authorId: moderated.place.authorId,
    }),
    threadId: moderated.threadId,
    ...(type === "post" && { postId: moderated.id }),
  });
  return { ok: true };
}

export async function restoreForumContent(
  userId: string,
  type: ForumTarget,
  id: string,
): Promise<ActionResult> {
  const found = await findModerated(userId, type, id);
  if (!found?.moderated.hidden) return notFound(type);
  const { moderated, permission } = found;
  if (!permission.ok) return translateError(permission);

  const filter = { _id: moderated.id, hidden: { $exists: true } };
  const update = { $unset: { hidden: 1, purgeAt: 1 } };
  const { modifiedCount } =
    type === "post"
      ? await ForumPost.updateOne(filter, update)
      : await ForumThread.updateOne(filter, update);
  if (modifiedCount === 0) return notFound(type);
  if (type === "post") {
    await Reaction.updateMany(
      { targetType: "post", targetId: moderated.id },
      { $unset: { purgeAt: 1 } },
    );
  } else {
    // Posts hidden on their own keep their date.
    await ForumPost.updateMany(
      { threadId: moderated.id, hidden: { $exists: false } },
      { $unset: { purgeAt: 1 } },
    );
    const shown = (await ForumPost.distinct("_id", {
      threadId: moderated.id,
      hidden: { $exists: false },
    })) as Types.ObjectId[];
    await Reaction.updateMany(
      { targetType: "post", targetId: { $in: shown } },
      { $unset: { purgeAt: 1 } },
    );
  }
  await logModeration({
    ...community(moderated.place),
    actorId: userId,
    action: "restore",
    targetType: type,
    targetId: moderated.id,
    targetUserId: moderated.writerId,
  });
  return { ok: true };
}
