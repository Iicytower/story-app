import { auth } from "@/auth";
import type { ActionError } from "@/lib/action-result";
import { actionError } from "@/lib/i18n/action-error";

export async function requireUser(): Promise<
  { ok: true; userId: string; sessionId?: string } | ActionError
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return actionError("UNAUTHORIZED", "sessionExpired");
  return { ok: true, userId, sessionId: session.sid };
}
