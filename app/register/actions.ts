"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { createUser, userExists } from "@/lib/accounts";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { nicknameError, passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import {
  clientIp,
  giveBackAttempt,
  REGISTRATION_LIMIT,
  takeAttempt,
} from "@/lib/rate-limit";

const NICKNAME_TAKEN: ActionError = {
  ok: false,
  error: "DUPLICATE_NAME",
  message: "This nickname is already taken.",
};

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
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "These details are not valid.",
    };
  }
  const trimmed = nickname.trim();
  const invalid = nicknameError(trimmed) ?? passwordError(password);
  if (invalid) return { ok: false, error: "INVALID_INPUT", message: invalid };
  if (password !== repeatedPassword) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "The passwords do not match.",
    };
  }

  await connectDB();
  if (await userExists(trimmed)) return NICKNAME_TAKEN;

  const attempt = await takeAttempt(
    REGISTRATION_LIMIT,
    clientIp(await headers()),
  );
  if (!attempt) {
    return {
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many new accounts. Try again later.",
    };
  }
  if (!(await createUser(trimmed, password))) {
    await giveBackAttempt(attempt);
    return NICKNAME_TAKEN;
  }

  try {
    await signIn("credentials", {
      nickname: trimmed,
      password,
      redirectTo: "/stories",
    });
  } catch (error) {
    // The account exists; only the automatic sign-in hit the login limit.
    if (error instanceof AuthError) redirect("/login");
    // signIn signals success by throwing Next.js's redirect, which must propagate.
    throw error;
  }
  return { ok: true };
}
