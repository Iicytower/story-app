"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { formatPublishedAt } from "@/lib/publish/published-date";

const REFRESH_MS = 30_000;

const subscribeNever = () => () => {};

function subscribeEveryInterval(onChange: () => void) {
  const timer = setInterval(onChange, REFRESH_MS);
  return () => clearInterval(timer);
}

export function formatDate(
  iso: string,
  locale: string,
  withTime: boolean,
  timeZone?: string,
) {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "medium",
    ...(withTime && { timeStyle: "short" }),
    timeZone,
  });
}

export function formatFullDate(iso: string, locale: string, timeZone?: string) {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  });
}

export function formatRelative(
  iso: string,
  now: Date,
  locale: string,
  timeZone: string,
) {
  return formatPublishedAt(new Date(iso), now, locale, timeZone);
}

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The server does not know the viewer's time zone, so it renders UTC and the client re-renders in local time.
export function LocalDate({
  iso,
  withTime = false,
  relative = false,
  className,
}: {
  iso: string;
  withTime?: boolean;
  // "5 minutes ago", refreshed while shown, with the full date in the title.
  relative?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    relative ? subscribeEveryInterval : subscribeNever,
    () =>
      relative
        ? formatRelative(iso, new Date(), locale, localZone())
        : formatDate(iso, locale, withTime),
    () =>
      relative
        ? formatRelative(iso, new Date(), locale, "UTC")
        : formatDate(iso, locale, withTime, "UTC"),
  );
  const title = useSyncExternalStore(
    subscribeNever,
    () => (relative ? formatFullDate(iso, locale) : undefined),
    () => (relative ? formatFullDate(iso, locale, "UTC") : undefined),
  );
  return (
    <time
      dateTime={iso}
      title={title}
      className={className}
      // The relative text on the server is from a moment earlier than the hydration.
      suppressHydrationWarning={relative}
    >
      {text}
    </time>
  );
}
