"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  acceptModeratorInvite,
  declineModeratorInvite,
} from "@/app/[locale]/(protected)/moderation/actions";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCounts,
} from "@/app/[locale]/(protected)/notifications/actions";
import { formatDate, LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  isRealtimeLive,
  useRealtimeConnection,
  useRealtimeEvents,
} from "@/components/realtime";
import { useRouter } from "@/i18n/navigation";
import { groupByDay } from "@/lib/social/notification-groups";
import type { NotificationView } from "@/lib/social/notification-list";
import { POLL_MS, SAFETY_POLL_MS } from "@/lib/social/notifications";
import { cn } from "@/lib/utils";

export type UnreadUpdate = number | ((current: number) => number);

const COUNTS_CHANGED = "unread-counts-changed";

// E.g. after a conversation is read: the counters ask again at once instead of at the next poll.
export function refreshUnreadCounts() {
  window.dispatchEvent(new Event(COUNTS_CHANGED));
}

// The unread counters (notifications and conversations), polled every POLL_MS only while the tab
// is visible (D80) and the realtime stream is down, every SAFETY_POLL_MS while it is up
// (task 90): an event of the stream asks at
// once, and so do coming back to the tab and the stream coming up. A rise of notifications
// during the session shows a toast; messages have their own counter by the Messages entry.
export function useUnreadNotifications(
  initial: number,
  onOpen: () => void,
  initialMessages = 0,
  realtimeUrl: string | null = null,
): [number, (update: UnreadUpdate) => void, number] {
  const [count, setCount] = useState(initial);
  const [messages, setMessages] = useState(initialMessages);
  const last = useRef(initial);
  const t = useTranslations("notifications");
  const open = useRef(onOpen);
  useEffect(() => {
    open.current = onOpen;
  }, [onOpen]);

  const update = useCallback((next: UnreadUpdate) => {
    const value = typeof next === "function" ? next(last.current) : next;
    last.current = value;
    setCount(value);
  }, []);

  useRealtimeConnection(realtimeUrl);

  const poll = useCallback(async () => {
    const result = await unreadCounts().catch(() => null);
    if (!result?.ok) return;
    const added = result.notifications - last.current;
    if (added > 0) {
      toast(t("newToast", { count: added }), {
        action: { label: t("open"), onClick: () => open.current() },
      });
    }
    update(result.notifications);
    setMessages(result.messages);
  }, [t, update]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const every = useRef<number | null>(null);
  const sync = useCallback(() => {
    const wanted =
      document.visibilityState === "hidden"
        ? null
        : isRealtimeLive()
          ? SAFETY_POLL_MS
          : POLL_MS;
    if (wanted === every.current) return;
    if (timer.current !== null) clearInterval(timer.current);
    timer.current =
      wanted === null ? null : setInterval(() => void poll(), wanted);
    every.current = wanted;
  }, [poll]);
  const onLive = useCallback(() => {
    if (isRealtimeLive()) void poll();
    sync();
  }, [poll, sync]);
  const onMessage = useCallback(() => void poll(), [poll]);
  useRealtimeEvents(onLive, onMessage);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "hidden") void poll();
      sync();
    }
    const onChanged = () => void poll();
    sync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(COUNTS_CHANGED, onChanged);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
      timer.current = null;
      every.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(COUNTS_CHANGED, onChanged);
    };
  }, [poll, sync]);

  return [count, update, messages];
}

function Message({ item }: { item: NotificationView }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  if (item.type === "globalBan" && item.ban) {
    const { until, reason } = item.ban;
    // Loaded by the client only, so the viewer's own time zone.
    return (
      <>
        {until
          ? t("types.globalBan", {
              date: formatDate(until, locale, true),
              reason,
            })
          : t("types.globalBanForever", { reason })}
      </>
    );
  }
  const target = item.title
    ? t("target", { title: item.title })
    : t("unavailable");
  const values = {
    actor: item.actors[0] ?? t("someone"),
    others: Math.max(item.count - 1, 0),
    count: item.count,
    author: item.author ?? t("someone"),
    target,
  };
  const key =
    item.type === "hidden" && item.onThread
      ? "hiddenThread"
      : item.onPost &&
          (item.type === "reaction" ||
            item.type === "mention" ||
            item.type === "hidden")
        ? (`${item.type}Post` as const)
        : item.type === "reaction" && item.onComment
          ? "reactionComment"
          : item.type === "report" && !item.community
            ? "reportAdmin"
            : item.type === "mention" && item.inMessage
              ? "mentionMessage"
              : item.type;
  return <>{t(`types.${key}`, values)}</>;
}

function Item({
  item,
  onRead,
  onClose,
}: {
  item: NotificationView;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const main = useRef<HTMLButtonElement>(null);
  // The buttons answering an invitation go away: the focus moves to the notification itself,
  // once it is enabled again.
  const refocus = useRef(false);
  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    main.current?.focus();
  }, [pending]);

  function open() {
    startTransition(async () => {
      if (!item.read) {
        const result = await markNotificationRead(item.id).catch(() => null);
        if (result?.ok) onRead(item.id);
      }
      if (item.href) {
        onClose();
        router.push(item.href);
      }
    });
  }

  function answer(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const authorId = item.inviteFrom!;
      const result = await (
        accept
          ? acceptModeratorInvite(authorId)
          : declineModeratorInvite(authorId)
      ).catch(() => null);
      if (!result?.ok) return setError(result?.message ?? t("failed"));
      if (!item.read) {
        await markNotificationRead(item.id).catch(() => null);
        onRead(item.id);
      }
      if (accept) {
        onClose();
        router.push("/moderation");
      } else {
        refocus.current = true;
      }
    });
  }

  return (
    <li
      className={cn(
        "border-b px-1 py-2 last:border-b-0",
        !item.read && "bg-accent/40",
      )}
    >
      {/* The dot has its own column, so the text and the date line up read or not. */}
      <button
        ref={main}
        type="button"
        className="hover:bg-accent focus-visible:outline-ring grid w-full grid-cols-[0.5rem_1fr] gap-x-2 gap-y-1 rounded-md px-2 py-1 text-left [overflow-wrap:anywhere] focus-visible:outline-2 disabled:opacity-70"
        disabled={pending}
        onClick={open}
      >
        {!item.read ? (
          <span
            aria-label={t("unread")}
            role="img"
            className="bg-primary mt-1.5 size-2 rounded-full"
          />
        ) : (
          <span />
        )}
        <span>
          <Message item={item} />
        </span>
        <span className="text-muted-foreground col-start-2 text-xs">
          <LocalDate iso={item.updatedAt} relative />
        </span>
      </button>
      {item.inviteFrom && (
        <div className="flex gap-2 pt-1 pl-6">
          <Button size="sm" disabled={pending} onClick={() => answer(true)}>
            {t("accept")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => answer(false)}
          >
            {t("decline")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive pt-1 pl-6 text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

// The list is read when the panel opens.
export function NotificationsPanel({
  open,
  onOpenChange,
  onUnreadChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadChange: (update: UnreadUpdate) => void;
  // Where the focus goes back to: the bell, or the menu when the bell is in the closed drawer.
  onCloseAutoFocus: (event: Event) => void;
}) {
  const t = useTranslations("notifications");
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-0 right-0 left-auto flex h-dvh max-w-full translate-x-0 translate-y-0 flex-col gap-2 rounded-none sm:max-w-sm"
        // Not the Close button: its tooltip would open and take the first Escape.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle ref={title} tabIndex={-1} className="pr-8 outline-none">
          {t("title")}
        </DialogTitle>
        <PanelContent
          onUnreadChange={onUnreadChange}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PanelContent({
  onUnreadChange,
  onClose,
}: {
  onUnreadChange: (update: UnreadUpdate) => void;
  onClose: () => void;
}) {
  const t = useTranslations("notifications");
  const list = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void getNotifications()
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        if (!result?.ok) return setError(result?.message ?? t("failed"));
        setItems(result.notifications);
        onUnreadChange(result.unread);
      });
    return () => {
      active = false;
    };
  }, [t, onUnreadChange]);

  function markRead(id: string) {
    setItems(
      (current) =>
        current?.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ) ?? null,
    );
    onUnreadChange((count) => Math.max(count - 1, 0));
  }

  function markAll() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsRead().catch(() => null);
      if (!result?.ok) return setError(result?.message ?? t("failed"));
      setItems(
        (current) => current?.map((item) => ({ ...item, read: true })) ?? null,
      );
      onUnreadChange(0);
      // The button is disabled now that nothing is unread.
      list.current?.focus();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending || !items?.some((item) => !item.read)}
        onClick={markAll}
      >
        {t("markAllRead")}
      </Button>
      {!items && !error && (
        <p role="status" className="text-muted-foreground">
          {t("loading")}
        </p>
      )}
      {items?.length === 0 && (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
      {items && items.length > 0 && (
        <div
          ref={list}
          tabIndex={-1}
          role="group"
          aria-label={t("list")}
          className="-mx-1 flex flex-col gap-2 overflow-y-auto outline-none"
        >
          {groupByDay(items, new Date()).map(({ group, items: grouped }) => (
            <section key={group} aria-labelledby={`notifications-${group}`}>
              <h3
                id={`notifications-${group}`}
                className="text-muted-foreground px-3 pb-1 text-xs font-medium"
              >
                {t(group)}
              </h3>
              <ul aria-labelledby={`notifications-${group}`}>
                {grouped.map((item) => (
                  <Item
                    key={item.id}
                    item={item}
                    onRead={markRead}
                    onClose={onClose}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
