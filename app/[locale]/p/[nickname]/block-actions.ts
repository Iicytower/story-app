"use server";

import { refresh } from "next/cache";
import { findUserByNickname } from "@/lib/accounts";
import { isString } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { applyBlock, liftBlock, listBlocked } from "@/lib/social/blocks";

type BlockResult = ActionResult<{ blocked: boolean }>;

// No canInteract: blocking and unblocking work whatever the relation, also under a ban.
async function blockStep(
  nickname: string,
  blocked: boolean,
): Promise<BlockResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname))
    return actionError("INVALID_INPUT", "requestInvalid");
  await connectDB();
  // Before the lookup, so nicknames cannot be tried without a limit (task 91).
  if (!(await takeUserAttempt(SOCIAL_LIMITS.block, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  const other = await findUserByNickname(nickname);
  if (!other?.nickname) return actionError("NOT_FOUND", "userNotFound");
  if (other._id.equals(user.userId)) {
    return actionError("FORBIDDEN", "interactionNotAllowed");
  }
  await (blocked ? applyBlock : liftBlock)(user.userId, other._id);
  refresh();
  return { ok: true, blocked };
}

export async function blockUser(nickname: string): Promise<BlockResult> {
  return blockStep(nickname, true);
}

export async function unblockUser(nickname: string): Promise<BlockResult> {
  return blockStep(nickname, false);
}

// Read when the settings dialog opens (task 86).
export async function listBlockedUsers(): Promise<
  ActionResult<{ nicknames: string[]; total: number }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  await connectDB();
  return { ok: true, ...(await listBlocked(user.userId)) };
}
