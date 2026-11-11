"use server";

import { refresh } from "next/cache";
import { findUserByNickname } from "@/lib/accounts";
import { isString } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { Block } from "@/lib/models/block";
import { Follow } from "@/lib/models/follow";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { notifyLater } from "@/lib/social/notify";
import { canInteract } from "@/lib/social/permissions";

type FollowResult = ActionResult<{ following: boolean }>;

async function findFollowee(nickname: string) {
  const user = await findUserByNickname(nickname);
  return user?.nickname ? user : null;
}

export async function follow(nickname: string): Promise<FollowResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname))
    return actionError("INVALID_INPUT", "requestInvalid");
  await connectDB();
  const followee = await findFollowee(nickname);
  if (!followee) return actionError("NOT_FOUND", "userNotFound");
  // canInteract lets anyone act on their own content, so following oneself is refused here.
  if (followee._id.equals(user.userId)) {
    return actionError("FORBIDDEN", "interactionNotAllowed");
  }
  const permission = await canInteract(user.userId, {
    authorId: followee._id.toString(),
    kind: "follow",
  });
  if (!permission.ok) return translateError(permission);
  if (!(await takeUserAttempt(SOCIAL_LIMITS.follow, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }

  const edge = { followerId: user.userId, followeeId: followee._id };
  const inserted = await Follow.updateOne(
    edge,
    { $setOnInsert: edge },
    { upsert: true },
  ).then(
    ({ upsertedCount }) => upsertedCount === 1,
    (error: unknown) => {
      // Two clicks at once: the other request inserted the same follow.
      if (!isDuplicateKeyError(error)) throw error;
      return false;
    },
  );
  // A block saved after canInteract: blockUser's cleanup may have run before this insert.
  if (
    await Block.exists({
      $or: [
        { blockerId: user.userId, blockedId: followee._id },
        { blockerId: followee._id, blockedId: user.userId },
      ],
    })
  ) {
    await Follow.deleteOne(edge);
    return actionError("FORBIDDEN", "interactionNotAllowed");
  }
  if (inserted) {
    notifyLater(followee._id, { type: "follower", actorId: user.userId });
  }

  refresh();
  return { ok: true, following: true };
}

// No canInteract: leaving must work whatever the relation, e.g. after a ban.
export async function unfollow(nickname: string): Promise<FollowResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname))
    return actionError("INVALID_INPUT", "requestInvalid");
  await connectDB();
  const followee = await findFollowee(nickname);
  if (!followee) return actionError("NOT_FOUND", "userNotFound");
  if (!(await takeUserAttempt(SOCIAL_LIMITS.follow, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  await Follow.deleteOne({ followerId: user.userId, followeeId: followee._id });

  refresh();
  return { ok: true, following: false };
}
