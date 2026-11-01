"use client";

import {
  FolderIcon,
  KeyRoundIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { logout, saveSettings } from "@/app/(protected)/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyTheme, rememberTheme } from "@/lib/theme";
import { ChangePasswordDialog } from "./change-password-dialog";

function toggleTheme() {
  const theme = document.documentElement.classList.toggle("dark")
    ? "dark"
    : "light";
  document.documentElement.setAttribute("data-theme", theme);
  rememberTheme(theme);
  void saveSettings({ appearance: { theme } });
}

export function AccountMenu() {
  const [changingPassword, setChangingPassword] = useState(false);

  // React's dev-mode remount resets <html> attributes set by the inline script, and a
  // client-side sign-in brings another user's data-theme without running the script again.
  useLayoutEffect(() => {
    applyTheme();
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Scrolls away with the page, so it never covers the content. It sits in the
              32 px of padding above page content; the editor keeps room in its title row. */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Account"
            title="Account"
            className="absolute top-1 right-1 z-40"
          >
            <UserIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/stories">
              <FolderIcon />
              Stories
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleTheme}>
            <SunIcon className="hidden dark:block" />
            <MoonIcon className="dark:hidden" />
            Toggle theme
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChangingPassword(true)}>
            <KeyRoundIcon />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu, which unmounts its content when it closes. */}
      <ChangePasswordDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
      />
    </>
  );
}
