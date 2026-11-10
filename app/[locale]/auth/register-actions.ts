"use server";

import { headers } from "next/headers";
import { signInAfter } from "@/lib/auth/sign-in-after";
import {
  generateRecoveryCodes,
  storeRecoveryCodes,
} from "@/lib/auth/recovery-codes";
import { createUser, userExists } from "@/lib/accounts";
import type { ActionResult } from "@/lib/action-result";
import { nicknameError, passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { REGISTRATION_LIMIT, takeIpAttempt } from "@/lib/rate-limit";

const NICKNAME_TAKEN = () => actionError("DUPLICATE_NAME", "nicknameTaken");

export async function register(
  nickname: unknown,
  password: unknown,
  repeatedPassword: unknown,
): Promise<ActionResult<{ recoveryCodes: string[]; signedIn: boolean }>> {
  if (
    typeof nickname !== "string" ||
    typeof password !== "string" ||
    typeof repeatedPassword !== "string"
  ) {
    return actionError("INVALID_INPUT", "detailsInvalid");
  }
  const trimmed = nickname.trim();
  const invalid = nicknameError(trimmed) ?? passwordError(password, trimmed);
  if (invalid) {
    return actionError("INVALID_INPUT", invalid.key, invalid.values);
  }
  if (password !== repeatedPassword) {
    return actionError("INVALID_INPUT", "passwordsDoNotMatch");
  }

  await connectDB();
  // Before the nickname check, so the limit also slows down probing which nicknames exist (I1).
  const attempt = await takeIpAttempt(REGISTRATION_LIMIT, await headers());
  if (!attempt) {
    return actionError("RATE_LIMITED", "tooManyAccounts");
  }
  if (await userExists(trimmed)) return NICKNAME_TAKEN();
  // Shown once by the form; only their hashes are stored (D76).
  const recoveryCodes = generateRecoveryCodes();
  if (
    !(await createUser(trimmed, password, storeRecoveryCodes(recoveryCodes)))
  ) {
    return NICKNAME_TAKEN();
  }

  // The form shows the codes first, so this signs in without a redirect.
  return {
    ok: true,
    recoveryCodes,
    signedIn: await signInAfter(trimmed, password),
  };
}
