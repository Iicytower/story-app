import { useEffect } from "react";
import { realtimeToken } from "@/app/[locale]/(protected)/notifications/actions";
import type { RealtimeEvent } from "@/lib/social/realtime";

// The realtime stream of the account (task 90, D80): one EventSource per page, opened by the
// sidebar while the tab is visible. The counters and the open conversation listen to the window
// events below and poll only while it is down.
export type RealtimeMessage = RealtimeEvent;

const OPEN = "realtime-open";
const CLOSE = "realtime-close";
const EVENT = "realtime-event";
const RETRY_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;
const RENEW_BEFORE_MS = 60_000;

let live = false;

export const isRealtimeLive = () => live;

function setLive(value: boolean) {
  if (live === value) return;
  live = value;
  window.dispatchEvent(new Event(value ? OPEN : CLOSE));
}

// onChange runs when the stream comes up or goes down, onMessage with each event.
export function useRealtimeEvents(
  onChange: () => void,
  onMessage: (message: RealtimeMessage) => void,
) {
  useEffect(() => {
    const listener = (event: Event) =>
      onMessage((event as CustomEvent<RealtimeMessage>).detail);
    window.addEventListener(OPEN, onChange);
    window.addEventListener(CLOSE, onChange);
    window.addEventListener(EVENT, listener);
    return () => {
      window.removeEventListener(OPEN, onChange);
      window.removeEventListener(CLOSE, onChange);
      window.removeEventListener(EVENT, listener);
    };
  }, [onChange, onMessage]);
}

// Without the address (REALTIME_PUBLIC_URL) nothing opens and the page polls.
export function useRealtimeConnection(url: string | null) {
  useEffect(() => {
    if (!url) return;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = RETRY_MS;
    // A newer attempt (or closing) makes the pending ones stale.
    let attempt = 0;

    function clearTimer() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }
    function retry() {
      clearTimer();
      timer = setTimeout(() => void open(), retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
    function close() {
      attempt += 1;
      clearTimer();
      source?.close();
      source = null;
      setLive(false);
    }
    // Also the renewal: the old stream stays until the new one is open.
    async function open() {
      clearTimer();
      const current = ++attempt;
      const result = await realtimeToken().catch(() => null);
      if (current !== attempt) return;
      if (!result?.ok) return retry();
      const next = new EventSource(
        `${url}/rt/stream?token=${encodeURIComponent(result.token)}`,
      );
      next.onopen = () => {
        if (current !== attempt) return next.close();
        source?.close();
        source = next;
        retryMs = RETRY_MS;
        setLive(true);
        clearTimer();
        timer = setTimeout(
          () => void open(),
          Math.max(result.expiresAt - Date.now() - RENEW_BEFORE_MS, 1000),
        );
      };
      next.onmessage = (message: MessageEvent<string>) => {
        let detail: RealtimeMessage;
        try {
          detail = JSON.parse(message.data) as RealtimeMessage;
        } catch {
          return;
        }
        window.dispatchEvent(new CustomEvent(EVENT, { detail }));
      };
      // The browser would reconnect with the same, maybe expired, token: a new one instead.
      next.onerror = () => {
        next.close();
        if (source === next) {
          source = null;
          setLive(false);
        }
        if (current === attempt) retry();
      };
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") return close();
      if (source === null) void open();
    }
    if (document.visibilityState !== "hidden") void open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [url]);
}
