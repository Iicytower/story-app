"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import type { ActionError } from "@/lib/action-result";

export async function login(
  _previous: ActionError | null,
  formData: FormData,
): Promise<ActionError | null> {
  try {
    await signIn("credentials", {
      nickname: formData.get("nickname"),
      password: formData.get("password"),
      redirectTo: formData.get("callbackUrl")?.toString() || "/stories",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: "UNAUTHORIZED",
        message: "Invalid nickname or password.",
      };
    }
    // signIn signals success by throwing Next.js's redirect, which must propagate.
    throw error;
  }
  return null;
}
