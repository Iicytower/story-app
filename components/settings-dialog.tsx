"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  changeLocale,
  logout,
  saveSettings,
} from "@/app/[locale]/(protected)/actions";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, LOCALE_NAMES, routing } from "@/i18n/routing";
import { THEMES, type Theme } from "@/lib/settings/settings";
import { setTheme } from "@/lib/theme";

const SYSTEM = "system";
type ThemeChoice = Theme | typeof SYSTEM;
const THEME_CHOICES: ThemeChoice[] = [...THEMES, SYSTEM];

// The layout puts the saved theme on <html>, and Save keeps it there.
function savedTheme(): ThemeChoice {
  const value = document.documentElement.getAttribute("data-theme");
  return THEME_CHOICES.includes(value as ThemeChoice)
    ? (value as ThemeChoice)
    : SYSTEM;
}

// A new language remounts the layout with the sidebar, so the dialog is reopened from here.
const REOPEN_KEY = "settings-open";

// Read while rendering, cleared in an effect: StrictMode runs state initializers twice.
export function settingsReopenRequested(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      sessionStorage.getItem(REOPEN_KEY) !== null
    );
  } catch {
    return false;
  }
}

export function clearSettingsReopen(): void {
  try {
    sessionStorage.removeItem(REOPEN_KEY);
  } catch {}
}

const SELECT = "border-input bg-background h-9 rounded-md border px-2 text-sm";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so every opening starts from the saved values. */}
      <DialogContent aria-describedby={undefined}>
        <SettingsContent />
      </DialogContent>
    </Dialog>
  );
}

function SettingsContent() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [changingPassword, setChangingPassword] = useState(false);
  const [saved, setSaved] = useState(savedTheme);
  const [theme, setThemeChoice] = useState(saved);
  const [language, setLanguage] = useState(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = theme !== saved || language !== locale;

  if (changingPassword) {
    return <ChangePasswordForm onDone={() => setChangingPassword(false)} />;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      if (theme !== saved) {
        const value = theme === SYSTEM ? null : theme;
        const result = await saveSettings({ appearance: { theme: value } });
        if (!result.ok) return setError(result.message);
        setTheme(value);
        setSaved(theme);
      }
      if (language !== locale) {
        const result = await changeLocale(language);
        if (!result.ok) return setError(result.message);
        try {
          sessionStorage.setItem(REOPEN_KEY, "1");
        } catch {}
        // The same page and query in the new language.
        router.replace(`${pathname}${window.location.search}`, {
          locale: language,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>
      <section aria-labelledby="settings-appearance" className="grid gap-2">
        <h3 id="settings-appearance" className="font-medium">
          {t("appearance")}
        </h3>
        <Label htmlFor="settings-theme" className="font-normal">
          {t("theme")}
        </Label>
        <select
          id="settings-theme"
          className={SELECT}
          value={theme}
          onChange={(event) =>
            setThemeChoice(event.target.value as ThemeChoice)
          }
        >
          {THEME_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t(`themes.${choice}`)}
            </option>
          ))}
        </select>
      </section>
      <section aria-labelledby="settings-language" className="grid gap-2">
        <h3 id="settings-language" className="font-medium">
          {t("languageSection")}
        </h3>
        <Label htmlFor="settings-locale" className="font-normal">
          {t("language")}
        </Label>
        <select
          id="settings-locale"
          className={SELECT}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Locale)}
        >
          {routing.locales.map((option) => (
            <option key={option} value={option} lang={option}>
              {LOCALE_NAMES[option]}
            </option>
          ))}
        </select>
      </section>
      <section aria-labelledby="settings-account" className="grid gap-2">
        <h3 id="settings-account" className="font-medium">
          {t("account")}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setChangingPassword(true)}>
            {t("changePassword")}
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            {t("logOut")}
          </Button>
        </div>
      </section>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{tCommon("cancel")}</Button>
        </DialogClose>
        <Button disabled={!changed || pending} onClick={save}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </div>
  );
}
