import { describe, expect, it } from "vitest";
import { formatDate } from "./local-date";

const ISO = "2026-11-03T14:05:00.000Z";

describe("formatDate", () => {
  it("formats in the page's language", () => {
    expect(formatDate(ISO, "en", false, "UTC")).toBe("Nov 3, 2026");
    expect(formatDate(ISO, "en", true, "UTC")).toBe("Nov 3, 2026, 2:05 PM");
    expect(formatDate(ISO, "pl", false, "UTC")).toBe("3 lis 2026");
  });
});
