"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
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
): Promise<ActionResult> {
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
  if (!(await createUser(trimmed, password))) return NICKNAME_TAKEN();

  const locale = await getLocale();
  try {
    await signIn("credentials", {
      nickname: trimmed,
      password,
      redirectTo: `/${locale}`,
    });
  } catch (error) {
    // The account exists; only the automatic sign-in hit the login limit.
    if (error instanceof AuthError) redirect({ href: "/?auth=login", locale });
    // signIn signals success by throwing Next.js's redirect, which must propagate.
    throw error;
  }
  return { ok: true };
}
