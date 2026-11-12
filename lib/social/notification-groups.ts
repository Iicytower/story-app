export type DayGroup = "today" | "earlier";

// By the calendar day of the viewer's time zone: it runs in the browser only.
export function groupByDay<T extends { updatedAt: string }>(
  items: T[],
  now: Date,
): { group: DayGroup; items: T[] }[] {
  const today: T[] = [];
  const earlier: T[] = [];
  for (const item of items) {
    const date = new Date(item.updatedAt);
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    (sameDay ? today : earlier).push(item);
  }
  return [
    { group: "today" as const, items: today },
    { group: "earlier" as const, items: earlier },
  ].filter(({ items: list }) => list.length > 0);
}
