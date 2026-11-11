import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getUserSettings } from "@/lib/settings/queries";
import { hasPublication } from "@/lib/social/author-stats";
import { hasModerationAccess } from "@/lib/social/moderation";
import { countUnread } from "@/lib/social/notification-list";
import { toolsConfig } from "@/lib/tools/client";

export async function AppShell({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  // One publication check for both entries.
  const publication = hasPublication(userId);
  const [{ appearance }, moderation, unread, published] = await Promise.all([
    getUserSettings(userId),
    publication.then((value) => hasModerationAccess(userId, value)),
    countUnread(userId),
    publication,
  ]);
  const hiddenItems = [
    ...(moderation ? [] : ["moderation" as const]),
    ...(published ? [] : ["stats" as const]),
  ];
  return (
    <div className="flex min-h-dvh w-full">
      <AppSidebar
        defaultCollapsed={appearance.sidebarCollapsed}
        toolsAvailable={toolsConfig() !== null}
        hiddenItems={hiddenItems}
        initialUnread={unread}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
