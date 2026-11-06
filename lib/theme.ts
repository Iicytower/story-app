import type { Accent, Theme } from "@/lib/settings/settings";

export const THEME_STORAGE_KEY = "theme";

// Set on <html> for a signed-in user: the saved theme, or "system" when there is none.
// Pages without a session leave it out and use the browser's copy instead.
export type ThemeAttribute = Theme | "system";

// Runs in <head> before first paint. Keep in sync with applyTheme.
export const themeScript = `(function(){var d=document.documentElement,s=d.getAttribute("data-theme"),k="${THEME_STORAGE_KEY}";try{if(s){if(s==="system")localStorage.removeItem(k);else localStorage.setItem(k,s)}else s=localStorage.getItem(k)}catch(e){}d.classList.toggle("dark",s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))})()`;

// Storage access throws when the browser blocks it; the theme then comes from the page or the system.
function storedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

// null: follow the system. Mirrors what themeScript does with data-theme on the next load.
export function setTheme(theme: Theme | null): void {
  document.documentElement.setAttribute("data-theme", theme ?? "system");
  try {
    if (theme) localStorage.setItem(THEME_STORAGE_KEY, theme);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {}
  applyTheme();
}

// The same choice as themeScript, for after hydration.
export function applyTheme(): void {
  const root = document.documentElement;
  const saved = root.getAttribute("data-theme");
  const theme = saved ? (saved === "system" ? null : saved) : storedTheme();
  root.classList.toggle(
    "dark",
    theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
}

export function setAccent(accent: Accent): void {
  document.documentElement.setAttribute("data-accent", accent);
}
