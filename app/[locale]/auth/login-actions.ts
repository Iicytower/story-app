"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn } from "@/auth";
import type { ActionError } from "@/lib/action-result";
import { LoginRateLimited } from "@/lib/auth/authorize";
import { actionError } from "@/lib/i18n/action-error";

export async function login(
  _previous: ActionError | null,
  formData: FormData,
): Promise<ActionError | null> {
  try {
    await signIn("credentials", {
      nickname: formData.get("nickname"),
      password: formData.get("password"),
      redirectTo:
        formData.get("callbackUrl")?.toString() || `/${await getLocale()}`,
    });
  } catch (error) {
    if (error instanceof LoginRateLimited) {
      return actionError("RATE_LIMITED", "tooManyAttempts");
    }
    if (error instanceof AuthError) {
      return actionError("UNAUTHORIZED", "invalidCredentials");
    }
    // signIn signals success by throwing Next.js's redirect, which must propagate.
    throw error;
  }
  return null;
}
