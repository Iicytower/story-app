const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const RELATIVE_DAYS = 7;

// Rendered on the server, which does not know the viewer's time zone, so older dates are in UTC.
export function formatPublishedAt(
  date: Date,
  now: Date,
  locale: string,
): string {
  const ago = Math.max(0, now.getTime() - date.getTime());
  if (ago >= RELATIVE_DAYS * DAY) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date);
  }
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (ago < MINUTE) return relative.format(0, "second");
  if (ago < HOUR) return relative.format(-Math.floor(ago / MINUTE), "minute");
  if (ago < DAY) return relative.format(-Math.floor(ago / HOUR), "hour");
  return relative.format(-Math.floor(ago / DAY), "day");
}
