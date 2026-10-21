"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

function format(iso: string, withTime: boolean, timeZone?: string) {
  return new Date(iso).toLocaleString("en-US", {
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
  const text = useSyncExternalStore(
    subscribeNever,
    () => format(iso, withTime),
    () => format(iso, withTime, "UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
