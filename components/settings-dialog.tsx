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
import { getMessageSettings } from "@/app/[locale]/(protected)/messages/actions";
import {
  listBlockedUsers,
  unblockUser,
} from "@/app/[locale]/p/[nickname]/block-actions";
import { getNotificationSettings } from "@/app/[locale]/(protected)/notifications/actions";
import {
  getMyProfile,
  updateBio,
} from "@/app/[locale]/(protected)/profile/actions";
import { AvatarDialog } from "@/components/avatar-dialog";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
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
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, LOCALE_NAMES, routing } from "@/i18n/routing";
import { WithTooltip } from "@/components/ui/tooltip";
import {
  type Accent,
  ACCENTS,
  DM_FROM,
  type DmFrom,
  THEMES,
  type Theme,
} from "@/lib/settings/settings";
import { MAX_BIO_LENGTH } from "@/lib/limits";
import {
  NOTIFICATION_GROUPS,
  OPTIONAL_GROUPS,
  type OptionalNotificationType,
} from "@/lib/social/notifications";
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
  toolsAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Avatars need the classifier on the tools server (D56).
  toolsAvailable: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so every opening starts from the saved values. */}
      {/* The profile section made it taller than a laptop screen. */}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SettingsContent toolsAvailable={toolsAvailable} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsContent({ toolsAvailable }: { toolsAvailable: boolean }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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
  if (deletingAccount) {
    return <DeleteAccountForm onDone={() => setDeletingAccount(false)} />;
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
      <NotificationsSection />
      <MessagesSection />
      <BlockedSection />
      <ProfileSection toolsAvailable={toolsAvailable} />
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
        <div className="mt-4 grid gap-2">
          <p
            id="settings-delete-account-help"
            className="text-muted-foreground text-sm"
          >
            {t("deleteAccountHelp")}
          </p>
          <Button
            variant="destructive"
            className="justify-self-start"
            aria-describedby="settings-delete-account-help"
            onClick={() => setDeletingAccount(true)}
          >
            {t("deleteAccount")}
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

// One switch per kind in its group (D80); each change is saved at once, moderation has none.
function NotificationsSection() {
  const t = useTranslations("settings");
  const [settings, setSettings] = useState<Record<
    OptionalNotificationType,
    boolean
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    void getNotificationSettings()
      .catch(() => null)
      .then((result) => {
        if (!open) return;
        if (result?.ok) setSettings(result.settings);
        else setError(result?.message ?? t("notificationsFailed"));
      });
    return () => {
      open = false;
    };
  }, [t]);

  async function toggle(type: OptionalNotificationType, on: boolean) {
    setError(null);
    setSettings((current) => current && { ...current, [type]: on });
    const result = await saveSettings({ notifications: { [type]: on } }).catch(
      () => null,
    );
    if (!result?.ok) {
      setSettings((current) => current && { ...current, [type]: !on });
      setError(result?.message ?? t("notificationsFailed"));
    }
  }

  return (
    <section aria-labelledby="settings-notifications" className="grid gap-2">
      <h3 id="settings-notifications" className="font-medium">
        {t("notifications")}
      </h3>
      <p className="text-muted-foreground text-sm">{t("notificationsHelp")}</p>
      {!settings && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          {t("loadingNotifications")}
        </p>
      )}
      {settings &&
        OPTIONAL_GROUPS.map((group) => (
          <fieldset key={group} className="grid gap-1">
            <legend className="text-sm">
              {t(`notificationGroups.${group}`)}
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {NOTIFICATION_GROUPS[group].map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={settings[type]}
                    onChange={(event) =>
                      void toggle(type, event.target.checked)
                    }
                  />
                  {t(`notificationTypes.${type}`)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

// Who may start a conversation (D80); saved at once like the notification switches.
function MessagesSection() {
  const t = useTranslations("settings");
  const [dmFrom, setDmFrom] = useState<DmFrom | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    void getMessageSettings()
      .catch(() => null)
      .then((result) => {
        if (!open) return;
        if (result?.ok) setDmFrom(result.dmFrom);
        else setError(result?.message ?? t("messagesFailed"));
      });
    return () => {
      open = false;
    };
  }, [t]);

  async function choose(value: DmFrom) {
    const previous = dmFrom;
    setError(null);
    setDmFrom(value);
    const result = await saveSettings({ messages: { dmFrom: value } }).catch(
      () => null,
    );
    if (!result?.ok) {
      setDmFrom(previous);
      setError(result?.message ?? t("messagesFailed"));
    }
  }

  return (
    <section aria-labelledby="settings-messages" className="grid gap-2">
      <h3 id="settings-messages" className="font-medium">
        {t("messages")}
      </h3>
      {dmFrom && (
        <fieldset className="grid gap-1">
          <legend className="text-sm">{t("dmFrom")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {DM_FROM.map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm font-normal"
              >
                <input
                  type="radio"
                  name="dm-from"
                  className="accent-primary size-4"
                  checked={dmFrom === value}
                  onChange={() => void choose(value)}
                />
                {t(`dmFromOptions.${value}`)}
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">{t("dmFromHelp")}</p>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

// Read when the dialog opens; an unblock is saved at once (task 86).
function BlockedSection() {
  const t = useTranslations("settings");
  const tBlocking = useTranslations("blocking");
  const [blocked, setBlocked] = useState<{
    nicknames: string[];
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Several rows may be unblocked at once.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<number | null>(null);

  useEffect(() => {
    let open = true;
    void listBlockedUsers()
      .catch(() => null)
      .then((result) => {
        if (!open) return;
        if (result?.ok) setBlocked(result);
        else setError(result?.message ?? t("blockedFailed"));
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
  }, [blocked]);

  async function unblock(nickname: string, index: number) {
    setError(null);
    setRemoving((current) => new Set(current).add(nickname));
    const result = await unblockUser(nickname).catch(() => null);
    setRemoving((current) => {
      const next = new Set(current);
      next.delete(nickname);
      return next;
    });
    if (!result?.ok) return setError(result?.message ?? t("blockedFailed"));
    focusAfter.current = index;
    setBlocked(
      (current) =>
        current && {
          nicknames: current.nicknames.filter((n) => n !== nickname),
          total: current.total - 1,
        },
    );
  }

  return (
    <section aria-labelledby="settings-blocked" className="grid gap-2">
      <h3
        id="settings-blocked"
        ref={heading}
        tabIndex={-1}
        className="font-medium outline-none"
      >
        {t("blocked")}
      </h3>
      <p className="text-muted-foreground text-sm">{t("blockedHelp")}</p>
      <p role="status" className="text-sm">
        {blocked
          ? t("blockedCount", { count: blocked.total })
          : !error && t("loadingBlocked")}
      </p>
      {blocked && blocked.nicknames.length > 0 && (
        <ul
          ref={list}
          aria-labelledby="settings-blocked"
          className="flex max-h-40 flex-col gap-1 overflow-y-auto"
        >
          {blocked.nicknames.map((nickname, index) => (
            <li
              key={nickname}
              className="flex min-w-0 items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {nickname}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label={tBlocking("unblockUser", { nickname })}
                disabled={removing.has(nickname)}
                onClick={() => void unblock(nickname, index)}
              >
                {tBlocking("unblock")}
              </Button>
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

// Read when the dialog opens; the bio and the avatar are saved on their own, not with Save.
function ProfileSection({ toolsAvailable }: { toolsAvailable: boolean }) {
  const t = useTranslations("settings");
  const [profile, setProfile] = useState<{
    nickname: string | null;
    bio: string;
    avatar: string | null;
  } | null>(null);
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let open = true;
    void getMyProfile()
      .catch(() => null)
      .then((result) => {
        if (!open) return;
        if (result?.ok) {
          setProfile(result);
          setBio(result.bio);
        } else {
          setMessage({
            text: result?.message ?? t("profileFailed"),
            error: true,
          });
        }
      });
    return () => {
      open = false;
    };
  }, [t]);

  function saveBio() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateBio(bio).catch(() => null);
      if (!result?.ok) {
        setMessage({
          text: result?.message ?? t("profileFailed"),
          error: true,
        });
        return;
      }
      setProfile((current) => current && { ...current, bio: result.bio });
      setBio(result.bio);
      setMessage({ text: t("bioSaved"), error: false });
    });
  }

  return (
    <section aria-labelledby="settings-profile" className="grid gap-2">
      <h3 id="settings-profile" className="font-medium">
        {t("profile")}
      </h3>
      {!profile ? (
        !message && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("loadingProfile")}
          </p>
        )
      ) : (
        <>
          <Label htmlFor="settings-bio" className="font-normal">
            {t("bio")}
          </Label>
          <Textarea
            id="settings-bio"
            aria-describedby="settings-bio-help"
            value={bio}
            maxLength={MAX_BIO_LENGTH}
            rows={4}
            onChange={(event) => setBio(event.target.value)}
          />
          <div
            id="settings-bio-help"
            className="text-muted-foreground flex justify-between gap-2 text-xs"
          >
            <span>{t("bioHelp")}</span>
            <span className="shrink-0">
              {t("bioLength", { length: bio.length, max: MAX_BIO_LENGTH })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={pending || bio === profile.bio}
              onClick={saveBio}
            >
              {t("saveBio")}
            </Button>
            {profile.nickname && (
              <>
                <UserAvatar
                  nickname={profile.nickname}
                  src={profile.avatar}
                  alt=""
                  size={36}
                  className="ml-auto"
                />
                {toolsAvailable ? (
                  <Button variant="outline" onClick={() => setAvatarOpen(true)}>
                    {t("avatar")}
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {t("avatarsUnavailable")}
                  </span>
                )}
                <DialogClose asChild>
                  <Link
                    href="/profile"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    {t("viewProfile")}
                  </Link>
                </DialogClose>
                <AvatarDialog
                  open={avatarOpen}
                  onOpenChange={setAvatarOpen}
                  nickname={profile.nickname}
                  avatar={profile.avatar}
                  onChange={(avatar) =>
                    setProfile((current) => current && { ...current, avatar })
                  }
                />
              </>
            )}
          </div>
        </>
      )}
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "text-destructive text-sm" : "text-sm"}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
