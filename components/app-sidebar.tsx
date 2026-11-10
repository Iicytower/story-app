"use client";

import {
  BellIcon,
  ChartColumnIcon,
  FolderIcon,
  HouseIcon,
  LibraryIcon,
  MailIcon,
  MenuIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  ShieldIcon,
  ShieldUserIcon,
  UserIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { saveSettings } from "@/app/[locale]/(protected)/actions";
import {
  clearSettingsReopen,
  SettingsDialog,
  settingsReopenRequested,
} from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SOCIAL_NAV, type SocialNavItem } from "@/lib/social/nav";
import { applyTheme } from "@/lib/theme";

const ITEM = "w-full justify-start";

// Order from D80: feed and library above Folders, the rest below.
const SOCIAL_ABOVE_FOLDERS: SocialNavItem[] = ["feed", "library"];
const SOCIAL_BELOW_FOLDERS: SocialNavItem[] = [
  "forums",
  "messages",
  "notifications",
  "profile",
  "moderation",
  "admin",
  "stats",
];

const SOCIAL_LINKS: Record<SocialNavItem, { href: string; icon: ReactNode }> = {
  feed: { href: "/feed", icon: <NewspaperIcon /> },
  library: { href: "/library", icon: <LibraryIcon /> },
  forums: { href: "/forums", icon: <MessagesSquareIcon /> },
  messages: { href: "/messages", icon: <MailIcon /> },
  notifications: { href: "/notifications", icon: <BellIcon /> },
  profile: { href: "/profile", icon: <UserIcon /> },
  moderation: { href: "/moderation", icon: <ShieldIcon /> },
  admin: { href: "/admin", icon: <ShieldUserIcon /> },
  stats: { href: "/stats", icon: <ChartColumnIcon /> },
};

function NavLink({
  href,
  label,
  icon,
  compact,
  current,
  prefetch,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  compact: boolean;
  current?: boolean;
  prefetch?: false;
  onClick: () => void;
}) {
  const link = (
    <Button variant={current ? "secondary" : "ghost"} asChild className={ITEM}>
      <Link
        href={href}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        prefetch={prefetch}
        onClick={onClick}
      >
        {icon}
        {!compact && label}
      </Link>
    </Button>
  );
  return compact ? (
    <WithTooltip label={label} side="right">
      {link}
    </WithTooltip>
  ) : (
    link
  );
}

function ActionButton({
  label,
  icon,
  compact,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  compact: boolean;
  onClick: () => void;
}) {
  const button = (
    <Button
      variant="ghost"
      aria-label={label}
      className={ITEM}
      onClick={onClick}
    >
      {icon}
      {!compact && label}
    </Button>
  );
  return compact ? (
    <WithTooltip label={label} side="right">
      {button}
    </WithTooltip>
  ) : (
    button
  );
}

function NavItems({
  compact,
  onDone,
  onSettings,
}: {
  compact: boolean;
  onDone: () => void;
  onSettings: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const socialLinks = (items: SocialNavItem[]) =>
    items
      .filter((item) => SOCIAL_NAV[item])
      .map((item) => (
        <NavLink
          key={item}
          href={SOCIAL_LINKS[item].href}
          label={t(item)}
          icon={SOCIAL_LINKS[item].icon}
          compact={compact}
          current={pathname === SOCIAL_LINKS[item].href}
          onClick={onDone}
        />
      ));
  return (
    <>
      <NavLink
        href="/"
        label={t("home")}
        icon={<HouseIcon />}
        compact={compact}
        current={pathname === "/"}
        // Rendering the home page reads the public lists; a prefetch from every page,
        // also the editor, would do it on each visit.
        prefetch={false}
        onClick={onDone}
      />
      {socialLinks(SOCIAL_ABOVE_FOLDERS)}
      <NavLink
        href="/stories"
        label={t("folders")}
        icon={<FolderIcon />}
        compact={compact}
        current={pathname === "/stories"}
        onClick={onDone}
      />
      {socialLinks(SOCIAL_BELOW_FOLDERS)}
      <div className="mt-auto flex flex-col gap-1">
        <ActionButton
          label={t("settings")}
          icon={<SettingsIcon />}
          compact={compact}
          onClick={onSettings}
        />
      </div>
    </>
  );
}

export function AppSidebar({
  defaultCollapsed,
}: {
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(settingsReopenRequested);
  const t = useTranslations("sidebar");

  // React's dev-mode remount resets <html> attributes set by the inline script, and a
  // client-side sign-in brings another user's data-theme without running the script again.
  useLayoutEffect(() => {
    applyTheme();
  }, []);

  useEffect(clearSettingsReopen, []);

  function toggleCollapsed() {
    setCollapsed(!collapsed);
    void saveSettings({ appearance: { sidebarCollapsed: !collapsed } });
  }

  function openSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
  }

  return (
    <>
      <WithTooltip label={t("menu")} side="right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("menu")}
          className="absolute top-1 left-1 z-40 md:hidden"
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon />
        </Button>
      </WithTooltip>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="top-0 left-0 flex h-dvh max-w-64 translate-x-0 translate-y-0 flex-col gap-1 rounded-none pt-10 sm:max-w-64"
        >
          <DialogTitle className="sr-only">{t("menu")}</DialogTitle>
          <nav aria-label={t("mainNav")} className="flex flex-1 flex-col gap-1">
            <NavItems
              compact={false}
              onDone={() => setDrawerOpen(false)}
              onSettings={openSettings}
            />
          </nav>
        </DialogContent>
      </Dialog>
      <nav
        aria-label={t("mainNav")}
        data-collapsed={collapsed}
        className="bg-background sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r p-2 data-[collapsed=true]:w-12 md:flex"
      >
        <NavItems
          compact={collapsed}
          onDone={() => {}}
          onSettings={openSettings}
        />
        <ActionButton
          label={collapsed ? t("expand") : t("collapse")}
          icon={collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          compact={collapsed}
          onClick={toggleCollapsed}
        />
      </nav>
      {/* Outside the drawer, which unmounts its content when it closes. */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
