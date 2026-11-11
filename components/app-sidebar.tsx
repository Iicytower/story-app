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
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { saveSettings } from "@/app/[locale]/(protected)/actions";
import {
  clearSettingsReopen,
  SettingsDialog,
  settingsReopenRequested,
} from "@/components/settings-dialog";
import {
  NotificationsPanel,
  useUnreadNotifications,
} from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
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

// The bell opens a panel (D80) instead of a page.
const SOCIAL_LINKS: Record<
  Exclude<SocialNavItem, "notifications">,
  { href: string; icon: ReactNode }
> = {
  feed: { href: "/feed", icon: <NewspaperIcon /> },
  library: { href: "/library", icon: <LibraryIcon /> },
  forums: { href: "/forums", icon: <MessagesSquareIcon /> },
  messages: { href: "/messages", icon: <MailIcon /> },
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
  accessibleLabel = label,
  badge = 0,
  bell = false,
}: {
  label: string;
  icon: ReactNode;
  compact: boolean;
  onClick: () => void;
  accessibleLabel?: string;
  // A count shown next to the label, or as a dot on the icon when compact.
  badge?: number;
  // The notifications button, which gets the focus back when the panel closes.
  bell?: boolean;
}) {
  const button = (
    <Button
      variant="ghost"
      data-bell={bell || undefined}
      aria-label={accessibleLabel}
      className={`${ITEM} relative`}
      onClick={onClick}
    >
      {icon}
      {!compact && label}
      {badge > 0 &&
        (compact ? (
          <span
            aria-hidden
            className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full"
          />
        ) : (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 text-xs leading-5 font-medium"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ))}
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
  hiddenItems,
  unread,
  onDone,
  onSettings,
  onNotifications,
}: {
  compact: boolean;
  hiddenItems: SocialNavItem[];
  unread: number;
  onDone: () => void;
  onSettings: () => void;
  onNotifications: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const socialLinks = (items: SocialNavItem[]) =>
    items
      .filter((item) => SOCIAL_NAV[item] && !hiddenItems.includes(item))
      .map((item) =>
        item === "notifications" ? (
          <ActionButton
            key={item}
            bell
            label={t(item)}
            accessibleLabel={
              unread > 0 ? t("notificationsUnread", { count: unread }) : t(item)
            }
            icon={<BellIcon />}
            compact={compact}
            badge={unread}
            onClick={onNotifications}
          />
        ) : (
          <NavLink
            key={item}
            href={SOCIAL_LINKS[item].href}
            label={t(item)}
            icon={SOCIAL_LINKS[item].icon}
            compact={compact}
            current={pathname === SOCIAL_LINKS[item].href}
            onClick={onDone}
          />
        ),
      );
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
  toolsAvailable,
  hiddenItems = [],
  initialUnread = 0,
}: {
  defaultCollapsed: boolean;
  toolsAvailable: boolean;
  initialUnread?: number;
  // Entries that are on but not for this account.
  hiddenItems?: SocialNavItem[];
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(settingsReopenRequested);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const t = useTranslations("sidebar");
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const openNotifications = useCallback(() => {
    setDrawerOpen(false);
    setNotificationsOpen(true);
  }, []);
  const [unread, setUnread] = useUnreadNotifications(
    initialUnread,
    openNotifications,
  );

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
          ref={menu}
          aria-label={unread > 0 ? t("menuUnread") : t("menu")}
          className="absolute top-1 left-1 z-40 md:hidden"
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon />
          {unread > 0 && (
            <span
              aria-hidden
              className="bg-primary absolute top-1 right-1 size-2 rounded-full"
            />
          )}
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
              hiddenItems={hiddenItems}
              unread={unread}
              onDone={() => setDrawerOpen(false)}
              onSettings={openSettings}
              onNotifications={openNotifications}
            />
          </nav>
        </DialogContent>
      </Dialog>
      <nav
        ref={sidebar}
        aria-label={t("mainNav")}
        data-collapsed={collapsed}
        className="bg-background sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r p-2 data-[collapsed=true]:w-12 md:flex"
      >
        <NavItems
          compact={collapsed}
          hiddenItems={hiddenItems}
          unread={unread}
          onDone={() => {}}
          onSettings={openSettings}
          onNotifications={openNotifications}
        />
        <ActionButton
          label={collapsed ? t("expand") : t("collapse")}
          icon={collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          compact={collapsed}
          onClick={toggleCollapsed}
        />
      </nav>
      {/* Outside the drawer, which unmounts its content when it closes. */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        toolsAvailable={toolsAvailable}
      />
      <NotificationsPanel
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        onUnreadChange={setUnread}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Below md the sidebar is hidden and the bell is in the closed drawer.
          const bell =
            sidebar.current?.querySelector<HTMLElement>("[data-bell]");
          (bell?.checkVisibility() ? bell : menu.current)?.focus();
        }}
      />
      <Toaster position="bottom-right" containerAriaLabel={t("toasts")} />
    </>
  );
}
