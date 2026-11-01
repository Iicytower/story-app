"use server";

import { signOut } from "@/auth";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, verifyPassword } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { passwordError } from "@/lib/credentials";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { updateUserSettings } from "@/lib/settings/queries";
import { parseSettingsPatch } from "@/lib/settings/settings";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// Saves only the fields sent, so the layout and the theme can change independently.
export async function saveSettings(patch: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const parsed = parseSettingsPatch(patch);
  if (!parsed) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "These settings are not valid.",
    };
  }

  await updateUserSettings(user.userId, parsed);
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
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "These passwords are not valid.",
    };
  }
  if (newPassword !== repeatedPassword) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "The new passwords do not match.",
    };
  }
  const weakness = passwordError(newPassword);
  if (weakness) {
    return { ok: false, error: "INVALID_INPUT", message: weakness };
  }

  await connectDB();
  const account = await User.findById(user.userId).lean();
  if (
    !account ||
    !(await verifyPassword(currentPassword, account.passwordHash))
  ) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "The current password is incorrect.",
    };
  }

  await User.updateOne(
    { _id: account._id },
    { $set: { passwordHash: await hashPassword(newPassword) } },
  );
  return { ok: true };
}
