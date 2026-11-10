"use server";

import { headers } from "next/headers";
import { findUserByNickname, hashPassword } from "@/lib/accounts";
import type { ActionResult } from "@/lib/action-result";
import { LOGIN_DELAY_MS } from "@/lib/auth/authorize";
import {
  findUnusedCode,
  generateRecoveryCodes,
  storeRecoveryCodes,
} from "@/lib/auth/recovery-codes";
import { endOtherSessions } from "@/lib/auth/sessions";
import { signInAfter } from "@/lib/auth/sign-in-after";
import { passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { User } from "@/lib/models/user";
import {
  accountKey,
  giveBackAttempt,
  RECOVERY_ACCOUNT_LIMIT,
  RECOVERY_LIMIT,
  takeAttempt,
  takeIpAttempt,
} from "@/lib/rate-limit";

type Outcome = "reset" | "invalid" | "limited";

async function resetWithCode(
  nickname: string,
  code: string,
  password: string,
  requestHeaders: Headers,
): Promise<{ outcome: Outcome; userId?: string; codes?: string[] }> {
  await connectDB();
  const fromAddress = await takeIpAttempt(RECOVERY_LIMIT, requestHeaders);
  if (!fromAddress) return { outcome: "limited" };
  // Counted for nicknames without an account too, so the answer does not tell them apart.
  const forAccount = await takeAttempt(
    RECOVERY_ACCOUNT_LIMIT,
    accountKey(nickname),
  );
  if (!forAccount) return { outcome: "limited" };

  const user = await findUserByNickname(nickname);
  const hash = findUnusedCode(user?.recoveryCodes, code);
  if (!user || !hash) return { outcome: "invalid" };

  // Matching the unused code in the filter makes the code single-use even for parallel requests.
  // The new set replaces every earlier code (D76).
  const codes = generateRecoveryCodes();
  const { modifiedCount } = await User.updateOne(
    { _id: user._id, recoveryCodes: { $elemMatch: { hash, usedAt: null } } },
    {
      $set: {
        passwordHash: await hashPassword(password),
        recoveryCodes: storeRecoveryCodes(codes),
      },
    },
  );
  if (modifiedCount === 0) return { outcome: "invalid" };
  await giveBackAttempt(fromAddress.slot);
  await giveBackAttempt(forAccount);
  return { outcome: "reset", userId: user._id.toString(), codes };
}

export async function recoverAccount(
  nickname: unknown,
  code: unknown,
  password: unknown,
  repeatedPassword: unknown,
): Promise<ActionResult<{ recoveryCodes: string[]; signedIn: boolean }>> {
  if (
    typeof nickname !== "string" ||
    typeof code !== "string" ||
    typeof password !== "string" ||
    typeof repeatedPassword !== "string"
  ) {
    return actionError("INVALID_INPUT", "detailsInvalid");
  }
  if (password !== repeatedPassword) {
    return actionError("INVALID_INPUT", "passwordsDoNotMatch");
  }
  const trimmed = nickname.trim();
  const weak = passwordError(password, trimmed);
  if (weak) return actionError("INVALID_INPUT", weak.key, weak.values);

  // Every outcome takes the same fixed time, like signing in.
  const [result] = await Promise.all([
    resetWithCode(trimmed, code, password, await headers()),
    new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS)),
  ]);
  if (result.outcome === "limited") {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  if (result.outcome === "invalid") {
    return actionError("INVALID_INPUT", "recoveryInvalid");
  }
  // A new password after a lost one: whoever else is signed in has to sign in again (D75).
  await endOtherSessions(result.userId!, null);
  return {
    ok: true,
    recoveryCodes: result.codes!,
    signedIn: await signInAfter(trimmed, password),
  };
}
