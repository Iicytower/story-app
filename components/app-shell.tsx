import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { myAccount } from "@/lib/profiles/queries";
import { getUserSettings } from "@/lib/settings/queries";
import { hasPublication } from "@/lib/social/author-stats";
import { isActiveAdmin } from "@/lib/social/admin";
import {
  countPendingReports,
  hasModerationAccess,
} from "@/lib/social/moderation";
import { countUnreadConversations } from "@/lib/social/direct-messages";
import { countUnread } from "@/lib/social/notification-list";
import { realtimeUrl } from "@/lib/social/realtime";
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
  const moderationAccess = publication.then((value) =>
    hasModerationAccess(userId, value),
  );
  const [
    { appearance },
    moderation,
    pendingModeration,
    unread,
    unreadMessages,
    published,
    admin,
    account,
  ] = await Promise.all([
    getUserSettings(userId),
    moderationAccess,
    moderationAccess.then((access) =>
      access ? countPendingReports(userId) : 0,
    ),
    countUnread(userId),
    countUnreadConversations(userId),
    publication,
    isActiveAdmin(userId),
    myAccount(userId),
  ]);
  const hiddenItems = [
    ...(moderation ? [] : ["moderation" as const]),
    ...(admin ? [] : ["admin" as const]),
    ...(published ? [] : ["stats" as const]),
  ];
  return (
    <div className="flex min-h-dvh w-full">
      <AppSidebar
        defaultCollapsed={appearance.sidebarCollapsed}
        defaultEditorCollapsed={appearance.editorSidebarCollapsed}
        toolsAvailable={toolsConfig() !== null}
        hiddenItems={hiddenItems}
        nickname={account.nickname}
        avatar={account.avatar}
        initialUnread={unread}
        initialUnreadMessages={unreadMessages}
        pendingModeration={pendingModeration}
        realtimeUrl={realtimeUrl()}
      />
      {/* Below md the fixed top bar of the sidebar covers the first 2.5rem. */}
      <main className="flex min-w-0 flex-1 flex-col pt-10 md:pt-0">
        {children}
      </main>
    </div>
  );
}
