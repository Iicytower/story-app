import { auth } from "@/auth";
import type { ActionError } from "@/lib/action-result";

export async function requireUser(): Promise<
  { ok: true; userId: string } | ActionError
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    };
  }
  return { ok: true, userId };
}
