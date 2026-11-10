"use client";

import { useLocale, useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  changeLocale,
  listDictionary,
  logOutOtherDevices,
  logout,
  removeFromDictionary,
  saveSettings,
} from "@/app/[locale]/(protected)/actions";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { WithTooltip } from "@/components/ui/tooltip";
import {
  type Accent,
  ACCENTS,
  THEMES,
  type Theme,
} from "@/lib/settings/settings";
import { setAccent, setTheme } from "@/lib/theme";

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

function savedAccent(): Accent {
  const value = document.documentElement.getAttribute("data-accent");
  return ACCENTS.includes(value as Accent) ? (value as Accent) : ACCENTS[0];
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
  const [confirmLogOutOthers, setConfirmLogOutOthers] = useState(false);
  const [othersLoggedOut, setOthersLoggedOut] = useState(false);
  const [saved, setSaved] = useState(savedTheme);
  const [theme, setThemeChoice] = useState(saved);
  const [savedAccentValue, setSavedAccent] = useState(savedAccent);
  const [accent, setAccentChoice] = useState(savedAccentValue);
  const [language, setLanguage] = useState(locale);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed =
    theme !== saved || accent !== savedAccentValue || language !== locale;

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
      if (accent !== savedAccentValue) {
        const result = await saveSettings({ appearance: { accent } });
        if (!result.ok) return setError(result.message);
        setAccent(accent);
        setSavedAccent(accent);
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
        <span id="settings-accent" className="text-sm">
          {t("accent")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="settings-accent"
          className="flex gap-3 py-1"
        >
          {ACCENTS.map((choice) => (
            <WithTooltip key={choice} label={t(`accents.${choice}`)}>
              <label className="relative">
                <input
                  type="radio"
                  name="accent"
                  value={choice}
                  aria-label={t(`accents.${choice}`)}
                  checked={accent === choice}
                  onChange={() => setAccentChoice(choice)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                {/* data-accent gives the swatch that palette's --primary. */}
                <span
                  data-accent={choice}
                  className="bg-primary ring-offset-background peer-checked:ring-foreground peer-focus-visible:outline-ring block size-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4"
                />
              </label>
            </WithTooltip>
          ))}
        </div>
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
      <DictionarySection />
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
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setConfirmLogOutOthers(true)}
        >
          {t("logOutOthers")}
        </Button>
        {othersLoggedOut && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("logOutOthersDone")}
          </p>
        )}
        <ConfirmDialog
          open={confirmLogOutOthers}
          onOpenChange={setConfirmLogOutOthers}
          title={t("logOutOthersTitle")}
          description={t("logOutOthersDescription")}
          confirmLabel={t("logOutOthersConfirm")}
          action={logOutOtherDevices}
          onDone={() => setOthersLoggedOut(true)}
        />
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

// Read when the dialog opens: words added in the proofreading since the page loaded are
// shown, and no page has to be refreshed (task 30). A removal is saved at once.
function DictionarySection() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [words, setWords] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<number | null>(null);

  useEffect(() => {
    let open = true;
    void listDictionary()
      .catch(() => null)
      .then((result) => {
        if (!open) return;
        if (result?.ok) setWords(result.words);
        else setError(result?.message ?? t("dictionaryFailed"));
      });
    return () => {
      open = false;
    };
  }, [t]);

  // The removed row's button had the focus: it moves to the next one (or the heading).
  useEffect(() => {
    if (focusAfter.current === null) return;
    const buttons = list.current?.querySelectorAll("button") ?? [];
    const next = buttons[Math.min(focusAfter.current, buttons.length - 1)];
    (next ?? heading.current)?.focus();
    focusAfter.current = null;
  }, [words]);

  async function remove(word: string, index: number) {
    setError(null);
    setRemoving(word);
    const result = await removeFromDictionary(word).catch(() => null);
    setRemoving(null);
    if (!result?.ok) return setError(result?.message ?? t("dictionaryFailed"));
    focusAfter.current = index;
    setWords(result.words);
  }

  const sorted = words?.toSorted((a, b) => a.localeCompare(b, locale));
  return (
    <section aria-labelledby="settings-dictionary" className="grid gap-2">
      <h3
        id="settings-dictionary"
        ref={heading}
        tabIndex={-1}
        className="font-medium outline-none"
      >
        {t("dictionary")}
      </h3>
      <p className="text-muted-foreground text-sm">{t("dictionaryHelp")}</p>
      <p role="status" className="text-sm">
        {sorted
          ? t("dictionaryCount", { count: sorted.length })
          : !error && t("loadingDictionary")}
      </p>
      {sorted && sorted.length > 0 && (
        <ul
          ref={list}
          aria-labelledby="settings-dictionary"
          className="flex max-h-40 flex-wrap gap-1 overflow-y-auto"
        >
          {sorted.map((word, index) => (
            <li
              key={word}
              className="bg-secondary flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-sm"
            >
              {word}
              <WithTooltip label={t("removeWord", { word })}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("removeWord", { word })}
                  disabled={removing === word}
                  onClick={() => void remove(word, index)}
                >
                  <XIcon />
                </Button>
              </WithTooltip>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
