"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { signOut } from "@/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, routing } from "@/i18n/routing";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, verifyPassword } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { endOtherSessions } from "@/lib/auth/sessions";
import { passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { User } from "@/lib/models/user";
import { parseDictionaryWord } from "@/lib/proofreading/dictionary";
import {
  addDictionaryWord,
  getDictionary,
  removeDictionaryWord,
  updateUserSettings,
} from "@/lib/settings/queries";
import { parseSettingsPatch } from "@/lib/settings/settings";
import {
  CHANGE_PASSWORD_LIMIT,
  giveBackAttempt,
  takeAttempt,
} from "@/lib/rate-limit";

export async function logout() {
  await signOut({ redirectTo: `/${await getLocale()}` });
}

// Saves only the fields sent, so the layout and the theme can change independently.
export async function saveSettings(patch: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const parsed = parseSettingsPatch(patch);
  if (!parsed) {
    return actionError("INVALID_INPUT", "settingsInvalid");
  }

  await updateUserSettings(user.userId, parsed);
  return { ok: true };
}

// The dictionary of the proofreading (task 30). Each change returns the whole list, so the
// Settings view does not read it again. Nothing is revalidated: the editor page stays as is.
export async function listDictionary(): Promise<
  ActionResult<{ words: string[] }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  return { ok: true, words: await getDictionary(user.userId) };
}

export async function addToDictionary(
  word: unknown,
): Promise<ActionResult<{ words: string[] }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const parsed = parseDictionaryWord(word);
  if (parsed === null) {
    return actionError("INVALID_INPUT", "dictionaryWordInvalid");
  }
  const words = await addDictionaryWord(user.userId, parsed);
  if (!words) return actionError("INVALID_INPUT", "dictionaryFull");
  return { ok: true, words };
}

export async function removeFromDictionary(
  word: unknown,
): Promise<ActionResult<{ words: string[] }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const parsed = parseDictionaryWord(word);
  if (parsed === null) {
    return actionError("INVALID_INPUT", "dictionaryWordInvalid");
  }
  return { ok: true, words: await removeDictionaryWord(user.userId, parsed) };
}

// The setting follows the user to other devices, the cookie picks the language of
// addresses without a locale (D46).
export async function changeLocale(locale: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!hasLocale(routing.locales, locale)) {
    return actionError("INVALID_INPUT", "settingsInvalid");
  }

  await updateUserSettings(user.userId, { appearance: { locale } });
  (await cookies()).set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return { ok: true };
}

export async function changePassword(
  currentPassword: unknown,
  newPassword: unknown,
  repeatedPassword: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof repeatedPassword !== "string"
  ) {
    return actionError("INVALID_INPUT", "passwordsInvalid");
  }
  if (newPassword !== repeatedPassword) {
    return actionError("INVALID_INPUT", "newPasswordsDoNotMatch");
  }
  const weakness = passwordError(newPassword);
  if (weakness) {
    return actionError("INVALID_INPUT", weakness.key, weakness.values);
  }

  await connectDB();
  const account = await User.findById(user.userId).lean();
  if (!account) return actionError("UNAUTHORIZED", "sessionExpired");
  const weakForAccount = passwordError(newPassword, account.nickname);
  if (weakForAccount) {
    return actionError(
      "INVALID_INPUT",
      weakForAccount.key,
      weakForAccount.values,
    );
  }
  // Per user: a stolen session must not be able to guess the password (F4).
  const attempt = await takeAttempt(CHANGE_PASSWORD_LIMIT, user.userId);
  if (!attempt) return actionError("RATE_LIMITED", "tooManyAttempts");
  if (!(await verifyPassword(currentPassword, account.passwordHash))) {
    return actionError("INVALID_INPUT", "currentPasswordIncorrect");
  }
  await giveBackAttempt(attempt);

  await User.updateOne(
    { _id: account._id },
    { $set: { passwordHash: await hashPassword(newPassword) } },
  );
  // Other devices may be someone who took over the account (F3); this one stays signed in.
  await endOtherSessions(user.userId, user.sessionId ?? null);
  return { ok: true };
}

export async function logOutOtherDevices(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  await endOtherSessions(user.userId, user.sessionId ?? null);
  return { ok: true };
}
