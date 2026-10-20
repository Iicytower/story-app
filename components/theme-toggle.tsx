"use client";

import { useLayoutEffect } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeToggle() {
  // React's dev-mode remount resets <html> attributes set by the inline script; no-op in production.
  // Storage access throws when the browser blocks it; the theme then lasts until a reload.
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY) === "dark") {
        document.documentElement.classList.add("dark");
      }
    } catch {}
  }, []);

  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {}
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
