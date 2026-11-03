"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

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

// The server does not know the viewer's time zone, so it renders UTC and the client re-renders in local time.
export function LocalDate({
  iso,
  withTime = false,
}: {
  iso: string;
  withTime?: boolean;
}) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    subscribeNever,
    () => formatDate(iso, locale, withTime),
    () => formatDate(iso, locale, withTime, "UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
