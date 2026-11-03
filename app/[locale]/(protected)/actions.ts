"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { signOut } from "@/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, routing } from "@/i18n/routing";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, verifyPassword } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import { actionError } from "@/lib/i18n/action-error";
import { User } from "@/lib/models/user";
import { updateUserSettings } from "@/lib/settings/queries";
import { parseSettingsPatch } from "@/lib/settings/settings";

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
  if (
    !account ||
    !(await verifyPassword(currentPassword, account.passwordHash))
  ) {
    return actionError("INVALID_INPUT", "currentPasswordIncorrect");
  }

  await User.updateOne(
    { _id: account._id },
    { $set: { passwordHash: await hashPassword(newPassword) } },
  );
  return { ok: true };
}
