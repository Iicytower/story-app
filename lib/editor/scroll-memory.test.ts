import { describe, expect, it } from "vitest";
import {
  MAX_SCROLL_ENTRIES,
  parseScrollEntries,
  pruneScrollEntries,
  SCROLL_TTL_MS,
  type ScrollEntries,
} from "./scroll-memory";

const anchor = { index: 3, fraction: 0.5 };

describe("parseScrollEntries", () => {
  it("keeps valid anchors and pixel positions", () => {
    const entries = {
      a: { savedAt: 1, positions: { content: anchor, chapters: 120 } },
    };
    expect(parseScrollEntries(JSON.stringify(entries))).toEqual(entries);
  });

  it("drops malformed entries and positions one by one", () => {
    const raw = JSON.stringify({
      a: {
        savedAt: 1,
        positions: {
          content: anchor,
          notes: { index: -1, fraction: 0 },
          folderNotes: { index: 1.5, fraction: 0 },
          other: { index: 1, fraction: 2 },
          chapters: -5,
          text: "top",
        },
      },
      b: { savedAt: "yesterday", positions: {} },
      c: { savedAt: 1 },
      d: null,
    });
    expect(parseScrollEntries(raw)).toEqual({
      a: { savedAt: 1, positions: { content: anchor } },
    });
  });

  it.each([null, "", "not json", "[]", "42"])("starts empty from %j", (raw) => {
    expect(parseScrollEntries(raw)).toEqual({});
  });
});

describe("pruneScrollEntries", () => {
  const now = Date.UTC(2026, 9, 30);

  it("forgets positions older than 30 days", () => {
    const entries: ScrollEntries = {
      fresh: { savedAt: now - SCROLL_TTL_MS, positions: { chapters: 1 } },
      old: { savedAt: now - SCROLL_TTL_MS - 1, positions: { chapters: 1 } },
    };
    expect(Object.keys(pruneScrollEntries(entries, now))).toEqual(["fresh"]);
  });

  it("keeps only the most recently saved chapters", () => {
    const entries: ScrollEntries = Object.fromEntries(
      Array.from({ length: MAX_SCROLL_ENTRIES + 5 }, (_, i) => [
        `story-${i}`,
        { savedAt: now - i, positions: { chapters: i } },
      ]),
    );
    const kept = Object.keys(pruneScrollEntries(entries, now));
    expect(kept).toHaveLength(MAX_SCROLL_ENTRIES);
    expect(kept).toContain("story-0");
    expect(kept).not.toContain(`story-${MAX_SCROLL_ENTRIES}`);
  });
});
