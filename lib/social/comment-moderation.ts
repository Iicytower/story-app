import type { Types } from "mongoose";
import { Comment, HIDDEN_COMMENT_TTL_DAYS } from "@/lib/models/comment";
import { Reaction } from "@/lib/models/reaction";
import { logModeration } from "@/lib/social/moderation";
import { notifyLater } from "@/lib/social/notify";

const DAY_MS = 24 * 60 * 60 * 1000;

interface HiddenComment {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  userId: Types.ObjectId;
  folderId: Types.ObjectId;
  storyId?: Types.ObjectId | null;
  hidden?: unknown;
}

// Hides a comment the actor may moderate: in the author's community, or as the admin for the
// whole site (task 88), which the log scope tells apart.
export async function applyCommentHide(
  actorId: string,
  comment: HiddenComment,
  reason: string | undefined,
  log: { authorId: Types.ObjectId | null; scope?: "global" },
): Promise<void> {
  if (comment.hidden) return;
  const now = new Date();
  const purgeAt = new Date(now.getTime() + HIDDEN_COMMENT_TTL_DAYS * DAY_MS);
  const { modifiedCount } = await Comment.updateOne(
    { _id: comment._id, deletedAt: null, hidden: { $exists: false } },
    {
      $set: {
        hidden: { by: actorId, at: now, ...(reason && { reason }) },
        purgeAt,
      },
    },
  );
  if (modifiedCount === 0) return;
  // Purged together, since the TTL index deletes the comment without its reactions.
  await Reaction.updateMany(
    { targetType: "comment", targetId: comment._id },
    { $set: { purgeAt } },
  );
  // A reaction checked against the comment before it was hidden may land after the first pass.
  await Reaction.updateMany(
    {
      targetType: "comment",
      targetId: comment._id,
      purgeAt: { $exists: false },
    },
    { $set: { purgeAt } },
  );
  await logModeration({
    ...log,
    actorId,
    action: "hide",
    targetType: "comment",
    targetId: comment._id,
    targetUserId: comment.userId,
    ...(reason && { reason }),
  });
  notifyLater(comment.userId, {
    type: "hidden",
    actorId,
    authorId: comment.authorId,
    folderId: comment.folderId,
    ...(comment.storyId && { storyIds: [comment.storyId] }),
    commentId: comment._id,
  });
}
