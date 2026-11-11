"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LocalDate } from "@/components/local-date";
import { MentionTextarea } from "@/components/mention-textarea";
import { refreshUnreadCounts } from "@/components/notifications";
import { SocialMarkdown } from "@/components/social-markdown";
import { Button } from "@/components/ui/button";
import { MAX_DM_LENGTH } from "@/lib/limits";
import type { MessageView } from "@/lib/social/direct-messages";
import { THREAD_POLL_MS } from "@/lib/social/notifications";
import { cn } from "@/lib/utils";
import { getMessages, markConversationRead, sendMessage } from "../actions";

function append(current: MessageView[], added: MessageView[]) {
  const known = new Set(current.map(({ id }) => id));
  return [...current, ...added.filter(({ id }) => !known.has(id))];
}

export function Thread({
  conversationId,
  nickname,
  initialMessages,
  initialHasOlder,
  initialClosed,
}: {
  conversationId: string;
  nickname: string;
  initialMessages: MessageView[];
  initialHasOlder: boolean;
  initialClosed: boolean;
}) {
  const t = useTranslations("messages");
  const tErrors = useTranslations("errors");
  const fieldId = useId();
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [closed, setClosed] = useState(initialClosed);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const last = useRef(initialMessages.at(-1)?.id ?? null);
  const end = useRef<HTMLDivElement>(null);
  // Whether the next new messages scroll into view: at first, after one's own message and
  // while the reader is at the end anyway, not while reading further up.
  const follow = useRef(true);

  const markRead = useCallback(async () => {
    const result = await markConversationRead(conversationId).catch(() => null);
    if (result?.ok) refreshUnreadCounts();
  }, [conversationId]);

  // New messages after the last one shown; true when the other party wrote any.
  // Without any shown yet, the latest page.
  const fetchNew = useCallback(async () => {
    const result = await getMessages(conversationId, {
      after: last.current,
    }).catch(() => null);
    if (!result?.ok) return false;
    setClosed(result.closed);
    if (result.messages.length === 0) return false;
    last.current = result.messages.at(-1)!.id;
    const bottom = end.current?.getBoundingClientRect().bottom ?? 0;
    if (bottom <= window.innerHeight + 100) follow.current = true;
    setMessages((current) => append(current, result.messages));
    return result.messages.some(({ own }) => !own);
  }, [conversationId]);

  useEffect(() => {
    void markRead();
  }, [markRead]);

  // New messages at the end come into view; older ones put before them do not move it.
  const newest = messages.at(-1)?.id;
  useEffect(() => {
    if (!follow.current) return;
    follow.current = false;
    end.current?.scrollIntoView({ block: "end" });
  }, [newest]);

  // Every THREAD_POLL_MS while the tab is visible (D80), at once when it comes back.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let active = true;
    async function poll() {
      if ((await fetchNew()) && active) await markRead();
    }
    function start() {
      if (timer === null)
        timer = setInterval(() => void poll(), THREAD_POLL_MS);
    }
    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") return stop();
      void poll();
      start();
    }
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNew, markRead]);

  async function loadOlder() {
    const before = messages[0]?.id;
    if (!before) return;
    setLoadingOlder(true);
    const result = await getMessages(conversationId, { before }).catch(
      () => null,
    );
    setLoadingOlder(false);
    if (!result?.ok) return setError(result?.message ?? t("failed"));
    setMessages((current) => [...result.messages, ...current]);
    setHasOlder(result.hasOlder);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      const result = await sendMessage(conversationId, body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      follow.current = true;
      await fetchNew();
    } catch {
      setError(tErrors("offline"));
    } finally {
      setSending(false);
      document.getElementById(fieldId)?.focus();
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {hasOlder && (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          disabled={loadingOlder}
          onClick={() => void loadOlder()}
        >
          {t("older")}
        </Button>
      )}
      <div role="log" aria-label={t("thread")} className="min-w-0">
        {messages.length === 0 && (
          <p className="text-muted-foreground">{t("noMessages")}</p>
        )}
        <ol className="flex min-w-0 flex-col gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "flex max-w-[85%] min-w-0 flex-col gap-1 rounded-lg border px-3 py-2",
                message.own ? "bg-primary/10 self-end" : "bg-card self-start",
              )}
            >
              <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                <span className="font-medium [overflow-wrap:anywhere]">
                  {message.own ? t("you") : nickname}
                </span>
                <LocalDate iso={message.createdAt} withTime />
              </span>
              <SocialMarkdown
                content={message.body}
                mentions={message.mentions}
              />
            </li>
          ))}
        </ol>
      </div>
      <div ref={end} />
      {closed && (
        <p
          role="status"
          className="text-muted-foreground rounded-md border p-3"
        >
          {t("closedNotice")}
        </p>
      )}
      {/* Kept when the conversation closes, so what was typed is not lost. */}
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-2">
        <label htmlFor={fieldId} className="sr-only">
          {t("newLabel")}
        </label>
        <MentionTextarea
          id={fieldId}
          value={body}
          onValueChange={setBody}
          placeholder={t("placeholder")}
          maxLength={MAX_DM_LENGTH}
          rows={3}
          disabled={closed}
          required
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={closed || sending || !body.trim()}
          >
            {t("send")}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
