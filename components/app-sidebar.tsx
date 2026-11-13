"use client";

import {
  BellIcon,
  BookOpenIcon,
  ChartColumnIcon,
  FolderIcon,
  HouseIcon,
  LibraryIcon,
  LogOutIcon,
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
import { logout, saveSettings } from "@/app/[locale]/(protected)/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { Toaster } from "@/components/ui/sonner";
import { WithTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { applyTheme } from "@/lib/theme";
import { onOpenSettings, type SettingsTab } from "@/lib/settings/open-settings";

const ITEM = "w-full justify-start";

export type SocialNavItem =
  | "feed"
  | "library"
  | "forums"
  | "messages"
  | "notifications"
  | "profile"
  | "moderation"
  | "admin"
  | "stats";

// Order from D80: feed and library above Folders, the rest below; moderation, rarely used,
// at the bottom above the account (D83).
const SOCIAL_ABOVE_FOLDERS: SocialNavItem[] = ["feed", "library"];
const SOCIAL_BELOW_FOLDERS: SocialNavItem[] = [
  "forums",
  "messages",
  "notifications",
  "profile",
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

// A count shown next to the label, or as a dot on the icon when compact.
function Badge({ count, compact }: { count: number; compact: boolean }) {
  if (count <= 0) return null;
  return compact ? (
    <span
      aria-hidden
      className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full"
    />
  ) : (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 text-xs leading-5 font-medium"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  href,
  label,
  icon,
  compact,
  current,
  prefetch,
  onClick,
  accessibleLabel = label,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  compact: boolean;
  current?: boolean;
  prefetch?: false;
  onClick: () => void;
  accessibleLabel?: string;
  badge?: number;
}) {
  const link = (
    <Button
      variant={current ? "secondary" : "ghost"}
      asChild
      className={`${ITEM} relative`}
    >
      <Link
        href={href}
        aria-label={accessibleLabel}
        aria-current={current ? "page" : undefined}
        prefetch={prefetch}
        onClick={onClick}
      >
        {icon}
        {!compact && label}
        <Badge count={badge} compact={compact} />
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
      <Badge count={badge} compact={compact} />
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

function AppName({
  compact,
  onClick,
}: {
  compact: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("common");
  const link = (
    <Link
      href="/"
      prefetch={false}
      aria-label={compact ? t("appName") : undefined}
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-md px-2.5 font-semibold"
    >
      <BookOpenIcon aria-hidden className="size-4 shrink-0" />
      {!compact && t("appName")}
    </Link>
  );
  return compact ? (
    <WithTooltip label={t("appName")} side="right">
      {link}
    </WithTooltip>
  ) : (
    link
  );
}

function AccountMenu({
  compact,
  nickname,
  avatar,
  profilePath,
  onSettings,
}: {
  compact: boolean;
  nickname: string | null;
  avatar: string | null;
  profilePath: string | null;
  onSettings: () => void;
}) {
  const t = useTranslations("sidebar");
  const name = nickname ?? t("account");
  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        aria-label={t("accountMenu", { name })}
        className={`${ITEM} px-1.5`}
      >
        <UserAvatar nickname={nickname ?? ""} src={avatar} alt="" size={22} />
        {!compact && <span className="truncate">{name}</span>}
      </Button>
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu modal={false}>
      {compact ? (
        <WithTooltip label={name} side="right">
          {trigger}
        </WithTooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent side="top" className="min-w-48">
        {profilePath !== null && (
          <DropdownMenuItem asChild>
            <Link href={profilePath}>
              <UserIcon />
              {t("profile")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onSettings}>
          <SettingsIcon />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon />
          {t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItems({
  compact,
  hiddenItems,
  nickname,
  avatar,
  profilePath,
  unread,
  unreadMessages,
  pendingModeration,
  onDone,
  onSettings,
  onNotifications,
}: {
  compact: boolean;
  hiddenItems: SocialNavItem[];
  nickname: string | null;
  avatar: string | null;
  profilePath: string | null;
  unread: number;
  unreadMessages: number;
  pendingModeration: number;
  onDone: () => void;
  onSettings: () => void;
  onNotifications: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const socialLinks = (items: SocialNavItem[]) =>
    items
      .filter((item) => !hiddenItems.includes(item))
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
            current={
              pathname === SOCIAL_LINKS[item].href ||
              (item === "profile" &&
                profilePath !== null &&
                pathname.toLowerCase() === profilePath.toLowerCase())
            }
            onClick={onDone}
            {...(item === "messages" && {
              badge: unreadMessages,
              accessibleLabel:
                unreadMessages > 0
                  ? t("messagesUnread", { count: unreadMessages })
                  : t(item),
            })}
          />
        ),
      );
  return (
    <>
      <AppName compact={compact} onClick={onDone} />
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
        href="/books"
        label={t("folders")}
        icon={<FolderIcon />}
        compact={compact}
        current={pathname === "/books"}
        onClick={onDone}
      />
      {socialLinks(SOCIAL_BELOW_FOLDERS)}
      <div className="mt-auto flex flex-col gap-1">
        {!hiddenItems.includes("moderation") && (
          <NavLink
            href={SOCIAL_LINKS.moderation.href}
            label={t("moderation")}
            icon={SOCIAL_LINKS.moderation.icon}
            compact={compact}
            current={pathname === SOCIAL_LINKS.moderation.href}
            onClick={onDone}
            badge={pendingModeration}
          />
        )}
        <AccountMenu
          compact={compact}
          nickname={nickname}
          avatar={avatar}
          profilePath={profilePath}
          onSettings={onSettings}
        />
      </div>
    </>
  );
}

export function AppSidebar({
  defaultCollapsed,
  defaultEditorCollapsed,
  toolsAvailable,
  hiddenItems = [],
  nickname = null,
  avatar = null,
  initialUnread = 0,
  initialUnreadMessages = 0,
  pendingModeration = 0,
  realtimeUrl = null,
}: {
  defaultCollapsed: boolean;
  // On the chapter editor (D83).
  defaultEditorCollapsed: boolean;
  toolsAvailable: boolean;
  initialUnread?: number;
  initialUnreadMessages?: number;
  // Shown by Moderation; filled in by task 106.
  pendingModeration?: number;
  // The realtime stream's address (task 90); without it the counters only poll.
  realtimeUrl?: string | null;
  // Entries that are not for this account.
  hiddenItems?: SocialNavItem[];
  // Null for an account without a nickname, which has no profile (D37).
  nickname?: string | null;
  avatar?: string | null;
}) {
  const profilePath = nickname === null ? null : `/p/${nickname}`;
  // Both kept: the sidebar stays mounted while the user moves between the editor and other pages.
  const [pageCollapsed, setPageCollapsed] = useState(defaultCollapsed);
  const [editorCollapsed, setEditorCollapsed] = useState(
    defaultEditorCollapsed,
  );
  const inEditor = usePathname().startsWith("/chapters/");
  const collapsed = inEditor ? editorCollapsed : pageCollapsed;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(settingsReopenRequested);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const t = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const openNotifications = useCallback(() => {
    setDrawerOpen(false);
    setNotificationsOpen(true);
  }, []);
  const [unread, setUnread, unreadMessages] = useUnreadNotifications(
    initialUnread,
    openNotifications,
    initialUnreadMessages,
    realtimeUrl,
  );

  // React's dev-mode remount resets <html> attributes set by the inline script, and a
  // client-side sign-in brings another user's data-theme without running the script again.
  useLayoutEffect(() => {
    applyTheme();
  }, []);

  useEffect(clearSettingsReopen, []);

  useEffect(
    () =>
      onOpenSettings((tab) => {
        setDrawerOpen(false);
        setSettingsTab(tab);
        setSettingsOpen(true);
      }),
    [],
  );

  function toggleCollapsed() {
    if (inEditor) {
      setEditorCollapsed(!collapsed);
      void saveSettings({ appearance: { editorSidebarCollapsed: !collapsed } });
    } else {
      setPageCollapsed(!collapsed);
      void saveSettings({ appearance: { sidebarCollapsed: !collapsed } });
    }
  }

  function openSettings() {
    setDrawerOpen(false);
    setSettingsTab("appearance");
    setSettingsOpen(true);
  }

  return (
    <>
      <div className="bg-background fixed inset-x-0 top-0 z-40 flex h-10 items-center gap-1 border-b px-1 md:hidden">
        <WithTooltip label={t("menu")} side="right">
          <Button
            variant="ghost"
            size="icon"
            ref={menu}
            aria-label={unread > 0 ? t("menuUnread") : t("menu")}
            // 44px touch target inside the 40px bar
            className="relative after:absolute after:-inset-1.5 after:content-['']"
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
        <Link href="/" prefetch={false} className="font-semibold">
          {tCommon("appName")}
        </Link>
      </div>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="top-0 left-0 flex h-dvh max-w-64 translate-x-0 translate-y-0 flex-col gap-1 rounded-none p-2 sm:max-w-64"
        >
          <DialogTitle className="sr-only">{t("menu")}</DialogTitle>
          <nav aria-label={t("mainNav")} className="flex flex-1 flex-col gap-1">
            <NavItems
              compact={false}
              hiddenItems={hiddenItems}
              nickname={nickname}
              avatar={avatar}
              profilePath={profilePath}
              unread={unread}
              unreadMessages={unreadMessages}
              pendingModeration={pendingModeration}
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
          nickname={nickname}
          avatar={avatar}
          profilePath={profilePath}
          unread={unread}
          unreadMessages={unreadMessages}
          pendingModeration={pendingModeration}
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
        tab={settingsTab}
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
