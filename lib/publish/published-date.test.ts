import { describe, expect, it } from "vitest";
import { formatPublishedAt } from "./published-date";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe("formatPublishedAt", () => {
  it("is relative within the last 7 days", () => {
    expect(formatPublishedAt(ago(10_000), NOW, "en")).toBe("now");
    expect(formatPublishedAt(ago(5 * MINUTE), NOW, "en")).toBe("5 minutes ago");
    expect(formatPublishedAt(ago(3 * 60 * MINUTE), NOW, "en")).toBe(
      "3 hours ago",
    );
    expect(formatPublishedAt(ago(DAY), NOW, "en")).toBe("yesterday");
    expect(formatPublishedAt(ago(3 * DAY), NOW, "en")).toBe("3 days ago");
    expect(formatPublishedAt(ago(7 * DAY - 1), NOW, "en")).toBe("6 days ago");
  });

  it("is a date from 7 days on", () => {
    expect(formatPublishedAt(ago(7 * DAY), NOW, "en")).toBe("Oct 28, 2026");
    expect(
      formatPublishedAt(new Date("2025-01-15T23:30:00.000Z"), NOW, "en"),
    ).toBe("Jan 15, 2025");
  });

  it("follows the interface language", () => {
    expect(formatPublishedAt(ago(3 * DAY), NOW, "pl")).toBe("3 dni temu");
    expect(formatPublishedAt(ago(DAY), NOW, "pl")).toBe("wczoraj");
    expect(formatPublishedAt(ago(7 * DAY), NOW, "pl")).toBe("28 paź 2026");
  });

  it("treats a date in the future as now", () => {
    expect(formatPublishedAt(ago(-MINUTE), NOW, "en")).toBe("now");
  });
});
