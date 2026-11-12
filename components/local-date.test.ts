import { describe, expect, it } from "vitest";
import { formatDate, formatFullDate, formatRelative } from "./local-date";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const relative = (ms: number, locale: string, timeZone = "UTC") =>
  formatRelative(ago(ms), NOW, locale, timeZone);

describe("formatRelative", () => {
  it("counts seconds, minutes, hours and days in English", () => {
    expect(relative(20 * SECOND, "en")).toBe("now");
    expect(relative(5 * MINUTE, "en")).toBe("5 minutes ago");
    expect(relative(2 * HOUR, "en")).toBe("2 hours ago");
    expect(relative(DAY, "en")).toBe("yesterday");
    expect(relative(3 * DAY, "en")).toBe("3 days ago");
  });

  it("counts seconds, minutes, hours and days in Polish", () => {
    expect(relative(20 * SECOND, "pl")).toBe("teraz");
    expect(relative(5 * MINUTE, "pl")).toBe("5 minut temu");
    expect(relative(2 * HOUR, "pl")).toBe("2 godziny temu");
    expect(relative(DAY, "pl")).toBe("wczoraj");
    expect(relative(3 * DAY, "pl")).toBe("3 dni temu");
  });

  it("gives the date after a week, in the given time zone", () => {
    const late = "2026-10-01T23:30:00.000Z";
    expect(formatRelative(late, NOW, "en", "UTC")).toBe("Oct 1, 2026");
    expect(formatRelative(late, NOW, "en", "Europe/Warsaw")).toBe(
      "Oct 2, 2026",
    );
  });
});

describe("formatFullDate", () => {
  it("shows the hour in the given time zone", () => {
    const iso = "2026-03-10T10:00:00.000Z";
    expect(formatFullDate(iso, "en", "UTC")).toBe("March 10, 2026 at 10:00 AM");
    expect(formatFullDate(iso, "pl", "Europe/Warsaw")).toBe(
      "10 marca 2026 11:00",
    );
  });
});

describe("formatDate", () => {
  const iso = "2026-11-03T14:05:00.000Z";

  it("formats in the page's language", () => {
    expect(formatDate(iso, "en", false, "UTC")).toBe("Nov 3, 2026");
    expect(formatDate(iso, "en", true, "UTC")).toBe("Nov 3, 2026, 2:05 PM");
    expect(formatDate(iso, "pl", false, "UTC")).toBe("3 lis 2026");
  });
});
