"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn } from "@/auth";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_OPTIONS,
  withLocale,
} from "@/i18n/routing";
import { findUserByNickname } from "@/lib/accounts";
import type { ActionError } from "@/lib/action-result";
import { LoginRateLimited } from "@/lib/auth/authorize";
import { actionError } from "@/lib/i18n/action-error";
import { getUserSettings } from "@/lib/settings/queries";

export async function login(
  _previous: ActionError | null,
  formData: FormData,
): Promise<ActionError | null> {
  if (!(formData instanceof FormData)) {
    return actionError("INVALID_INPUT", "detailsInvalid");
  }
  const nickname = formData.get("nickname");
  try {
    await signIn("credentials", {
      nickname,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof LoginRateLimited) {
      return actionError("RATE_LIMITED", "tooManyAttempts");
    }
    if (error instanceof AuthError) {
      return actionError("UNAUTHORIZED", "invalidCredentials");
    }
    throw error;
  }

  // Signed in: the language the user chose before, on any device, wins over this page's (D46).
  const user = await findUserByNickname(String(nickname));
  const saved = user
    ? (await getUserSettings(user._id.toString())).appearance.locale
    : null;
  if (saved) (await cookies()).set(LOCALE_COOKIE, saved, LOCALE_COOKIE_OPTIONS);
  // withLocale keeps only the path and query, so the callback cannot leave the site.
  redirect(
    withLocale(
      formData.get("callbackUrl")?.toString() || "/",
      saved ?? (await getLocale()),
    ),
  );
}
