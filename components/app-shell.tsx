import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getUserSettings } from "@/lib/settings/queries";
import { toolsConfig } from "@/lib/tools/client";

export async function AppShell({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { appearance } = await getUserSettings(userId);
  return (
    <div className="flex min-h-dvh w-full">
      <AppSidebar
        defaultCollapsed={appearance.sidebarCollapsed}
        toolsAvailable={toolsConfig() !== null}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
