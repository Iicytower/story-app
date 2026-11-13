import { describe, expect, it } from "vitest";
import {
  exceedsTagLimit,
  inheritedOnly,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  normalizeTag,
  normalizeTags,
  parseTagFilter,
  splitTagInput,
  tagFilterHref,
} from "./tags";

const many = (count: number, prefix = "t") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

describe("normalizeTag", () => {
  it("trims, collapses whitespace and lowercases, keeping Polish letters", () => {
    expect(normalizeTag("  Złota   Jesień\t")).toBe("złota jesień");
  });
});

describe("normalizeTags", () => {
  it("removes duplicates and empty tags", () => {
    expect(normalizeTags(["Fantasy", "fantasy ", "  ", "Draft"])).toEqual({
      ok: true,
      tags: ["fantasy", "draft"],
    });
  });

  it("rejects input that is not an array of strings", () => {
    for (const input of ["fantasy", null, [1], [{ $ne: "" }]]) {
      expect(normalizeTags(input)).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
      });
    }
  });

  it("enforces the length and count limits after normalizing", () => {
    expect(normalizeTags(["a".repeat(MAX_TAG_LENGTH)]).ok).toBe(true);
    expect(normalizeTags(["a".repeat(MAX_TAG_LENGTH + 1)]).ok).toBe(false);
    expect(normalizeTags(many(MAX_TAGS)).ok).toBe(true);
    expect(normalizeTags(many(MAX_TAGS + 1)).ok).toBe(false);
    expect(normalizeTags([...many(MAX_TAGS), "T0"]).ok).toBe(true);
  });
});

describe("splitTagInput", () => {
  it("splits on commas", () => {
    expect(splitTagInput("Sci Fi, draft,,draft")).toEqual(["sci fi", "draft"]);
  });
});

describe("parseTagFilter", () => {
  it("accepts a missing, single and repeated parameter", () => {
    expect(parseTagFilter(undefined)).toEqual([]);
    expect(parseTagFilter(" Fantasy")).toEqual(["fantasy"]);
    expect(parseTagFilter(["a", "A", "b", ""])).toEqual(["a", "b"]);
  });
});

describe("inherited tags", () => {
  it("lists only folder tags the chapter does not have", () => {
    expect(inheritedOnly(["a"], ["a", "b"])).toEqual(["b"]);
    expect(inheritedOnly(undefined, undefined)).toEqual([]);
  });

  it("counts own and inherited tags together, shared ones once", () => {
    expect(exceedsTagLimit(many(5), many(5, "f"))).toBe(false);
    expect(exceedsTagLimit(many(5), many(6, "f"))).toBe(true);
    expect(exceedsTagLimit(many(MAX_TAGS), many(MAX_TAGS))).toBe(false);
  });
});

describe("tagFilterHref", () => {
  it("adds a tag and keeps the query", () => {
    expect(tagFilterHref("smok", ["a"], "b")).toBe(
      "/books?q=smok&tag=a&tag=b",
    );
  });

  it("removes a selected tag", () => {
    expect(tagFilterHref("", ["a", "b"], "a")).toBe("/books?tag=b");
    expect(tagFilterHref("", ["a"], "a")).toBe("/books");
  });

  it("encodes spaces and Polish letters", () => {
    expect(tagFilterHref("", [], "złoty wiek")).toBe(
      "/books?tag=z%C5%82oty+wiek",
    );
  });
});
