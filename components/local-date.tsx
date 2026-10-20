"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

function format(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone,
  });
}

// The server does not know the viewer's time zone, so it renders UTC and the client re-renders in local time.
export function LocalDate({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribeNever,
    () => format(iso),
    () => format(iso, "UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
