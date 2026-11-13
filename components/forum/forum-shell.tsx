import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export async function forumViewer(): Promise<string | null> {
  const user = await requireUser();
  return user.ok ? user.userId : null;
}

// A guest reads the forums without the sidebar (D80), as on the profile.
export function ForumShell({
  viewerId,
  children,
}: {
  viewerId: string | null;
  children: ReactNode;
}) {
  return viewerId ? (
    <AppShell userId={viewerId}>{children}</AppShell>
  ) : (
    <main className="flex flex-1 flex-col">{children}</main>
  );
}
