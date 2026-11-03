"use client";

import {
  FolderIcon,
  HouseIcon,
  KeyRoundIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { logout, saveSettings } from "@/app/[locale]/(protected)/actions";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { applyTheme, rememberTheme } from "@/lib/theme";

function toggleTheme() {
  const theme = document.documentElement.classList.toggle("dark")
    ? "dark"
    : "light";
  document.documentElement.setAttribute("data-theme", theme);
  rememberTheme(theme);
  void saveSettings({ appearance: { theme } });
}

const ITEM = "w-full justify-start";

function NavLink({
  href,
  label,
  icon,
  compact,
  current,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  compact: boolean;
  current?: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={current ? "secondary" : "ghost"} asChild className={ITEM}>
      <Link
        href={href}
        title={label}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        onClick={onClick}
      >
        {icon}
        {!compact && label}
      </Link>
    </Button>
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
  return (
    <Button
      variant="ghost"
      title={label}
      aria-label={label}
      className={ITEM}
      onClick={onClick}
    >
      {icon}
      {!compact && label}
    </Button>
  );
}

function NavItems({
  compact,
  onDone,
  onChangePassword,
}: {
  compact: boolean;
  onDone: () => void;
  onChangePassword: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <NavLink
        href="/"
        label="Home"
        icon={<HouseIcon />}
        compact={compact}
        onClick={onDone}
      />
      <NavLink
        href="/"
        label="Search"
        icon={<SearchIcon />}
        compact={compact}
        current={pathname === "/"}
        onClick={onDone}
      />
      <NavLink
        href="/stories"
        label="Folders"
        icon={<FolderIcon />}
        compact={compact}
        current={pathname === "/stories"}
        onClick={onDone}
      />
      <div className="mt-auto flex flex-col gap-1">
        <ActionButton
          label="Toggle theme"
          icon={
            <>
              <SunIcon className="hidden dark:block" />
              <MoonIcon className="dark:hidden" />
            </>
          }
          compact={compact}
          onClick={() => {
            toggleTheme();
            onDone();
          }}
        />
        <ActionButton
          label="Change password"
          icon={<KeyRoundIcon />}
          compact={compact}
          onClick={onChangePassword}
        />
        <ActionButton
          label="Log out"
          icon={<LogOutIcon />}
          compact={compact}
          onClick={() => void logout()}
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
  const [changingPassword, setChangingPassword] = useState(false);

  // React's dev-mode remount resets <html> attributes set by the inline script, and a
  // client-side sign-in brings another user's data-theme without running the script again.
  useLayoutEffect(() => {
    applyTheme();
  }, []);

  function toggleCollapsed() {
    setCollapsed(!collapsed);
    void saveSettings({ appearance: { sidebarCollapsed: !collapsed } });
  }

  function openPasswordDialog() {
    setDrawerOpen(false);
    setChangingPassword(true);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Menu"
        title="Menu"
        className="absolute top-1 left-1 z-40 md:hidden"
        onClick={() => setDrawerOpen(true)}
      >
        <MenuIcon />
      </Button>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="top-0 left-0 flex h-dvh max-w-64 translate-x-0 translate-y-0 flex-col gap-1 rounded-none pt-10 sm:max-w-64"
        >
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
            <NavItems
              compact={false}
              onDone={() => setDrawerOpen(false)}
              onChangePassword={openPasswordDialog}
            />
          </nav>
        </DialogContent>
      </Dialog>
      <nav
        aria-label="Main"
        data-collapsed={collapsed}
        className="bg-background sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r p-2 data-[collapsed=true]:w-12 md:flex"
      >
        <NavItems
          compact={collapsed}
          onDone={() => {}}
          onChangePassword={openPasswordDialog}
        />
        <ActionButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          compact={collapsed}
          onClick={toggleCollapsed}
        />
      </nav>
      {/* Outside the drawer, which unmounts its content when it closes. */}
      <ChangePasswordDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
      />
    </>
  );
}
