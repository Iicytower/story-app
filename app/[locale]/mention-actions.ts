"use server";

import { isString } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { actionError } from "@/lib/i18n/action-error";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { findNicknameSuggestions } from "@/lib/social/mentions";

const PREFIX = /^[A-Za-z0-9_-]{1,30}$/;

// The nickname suggestions after an @ in comments, and later posts and messages (task 82).
export async function suggestNicknames(
  prefix: string,
): Promise<ActionResult<{ nicknames: string[] }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(prefix) || !PREFIX.test(prefix)) {
    return actionError("INVALID_INPUT", "requestInvalid");
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.suggest, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  return {
    ok: true,
    nicknames: await findNicknameSuggestions(user.userId, prefix),
  };
}
