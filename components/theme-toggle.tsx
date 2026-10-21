"use client";

import { useLayoutEffect } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { saveSettings } from "@/app/(protected)/actions";
import { Button } from "@/components/ui/button";
import { applyTheme, rememberTheme } from "@/lib/theme";

export function ThemeToggle() {
  // React's dev-mode remount resets <html> attributes set by the inline script, and a
  // client-side sign-in brings another user's data-theme without running the script again.
  useLayoutEffect(() => {
    applyTheme();
  }, []);

  function toggle() {
    const theme = document.documentElement.classList.toggle("dark")
      ? "dark"
      : "light";
    document.documentElement.setAttribute("data-theme", theme);
    rememberTheme(theme);
    void saveSettings({ appearance: { theme } });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
