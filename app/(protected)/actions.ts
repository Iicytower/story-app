"use server";

import { signOut } from "@/auth";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
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
