"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { suggestNicknames } from "@/app/[locale]/mention-actions";
import { MentionTextarea } from "@/components/mention-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { MAX_DM_LENGTH } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { startConversation } from "./actions";

// The same prefix suggestNicknames accepts.
const PREFIX = /^[A-Za-z0-9_-]{1,30}$/;
const DEBOUNCE_MS = 150;

function RecipientInput({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("mentions");
  const listId = useId();
  const [nicknames, setNicknames] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const prefix = value.trim();
  // Only what fits the prefix typed now, and not the nickname already chosen.
  const shown = nicknames.filter(
    (nickname) =>
      nickname.toLowerCase().startsWith(prefix.toLowerCase()) &&
      nickname !== value,
  );
  const open = !dismissed && shown.length > 0;
  const current = Math.min(active, shown.length - 1);

  useEffect(() => {
    if (!PREFIX.test(prefix)) return;
    let live = true;
    const timer = setTimeout(async () => {
      const result = await suggestNicknames(prefix);
      if (live) setNicknames(result.ok ? result.nicknames : []);
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [prefix]);

  function choose(nickname: string) {
    onValueChange(nickname);
    setDismissed(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + shown.length) % shown.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      choose(shown[current]);
    } else if (event.key === "Escape") {
      // The dialog stays open; only the list closes.
      event.preventDefault();
      event.stopPropagation();
      setDismissed(true);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setDismissed(false);
          setActive(0);
        }}
        onBlur={() => setDismissed(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${current}` : undefined}
        required
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("suggestions")}
          // The input keeps the focus when an option is clicked.
          onMouseDown={(event) => event.preventDefault()}
          className="bg-popover text-popover-foreground absolute top-full left-0 z-20 mt-1 w-full max-w-xs rounded-md border p-1 shadow-md"
        >
          {shown.map((nickname, index) => (
            <li
              key={nickname}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === current}
              onClick={() => choose(nickname)}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm [overflow-wrap:anywhere]",
                index === current && "bg-accent text-accent-foreground",
              )}
            >
              {nickname}
            </li>
          ))}
        </ul>
      )}
      <span role="status" className="sr-only">
        {open ? t("count", { count: shown.length }) : ""}
      </span>
    </div>
  );
}

// A conversation with anyone from the messages page; startConversation goes on in the existing
// one when the two already have it.
export function NewMessageButton() {
  const t = useTranslations("messages");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const recipientId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      const result = await startConversation(recipient.trim(), body);
      if (!result.ok) {
        setError(result.message);
        setSending(false);
        return;
      }
      router.push(`/messages/${result.id}`);
    } catch {
      setError(tErrors("offline"));
      setSending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("new")}</Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={recipientId} className="text-sm font-medium">
                {t("recipient")}
              </label>
              <RecipientInput
                id={recipientId}
                value={recipient}
                onValueChange={setRecipient}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={bodyId} className="text-sm font-medium">
                {t("newLabel")}
              </label>
              <MentionTextarea
                id={bodyId}
                value={body}
                onValueChange={setBody}
                placeholder={t("placeholder")}
                maxLength={MAX_DM_LENGTH}
                rows={4}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={sending || !recipient.trim() || !body.trim()}
              >
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
