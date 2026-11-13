import { describe, expect, it } from "vitest";
import {
  canonicalTag,
  canonicalTags,
  labelOf,
  matchingSuggestions,
  MAX_SUGGESTIONS,
  tagsForQuery,
  validatePredefinedTag,
} from "./predefined";

const SCI_FI = {
  key: "sci-fi",
  labels: { en: "Science fiction", pl: "Fantastyka naukowa" },
};
const CRIME = { key: "crime", labels: { en: "Crime", pl: "Kryminał" } };
const LIST = [SCI_FI, CRIME];

describe("canonicalTag", () => {
  it("turns a label in any language into the key", () => {
    expect(canonicalTag("Science  Fiction", LIST)).toBe("sci-fi");
    expect(canonicalTag("KRYMINAŁ", LIST)).toBe("crime");
    expect(canonicalTag("crime", LIST)).toBe("crime");
  });

  it("leaves own tags normalized, also near-misses of a label", () => {
    expect(canonicalTag(" Scifi ", LIST)).toBe("scifi");
    expect(canonicalTag("Science", LIST)).toBe("science");
  });
});

describe("canonicalTags", () => {
  it("drops duplicates that meet at the key", () => {
    expect(
      canonicalTags(["sci-fi", "fantastyka naukowa", "draft"], LIST),
    ).toEqual(["sci-fi", "draft"]);
  });
});

describe("tagsForQuery", () => {
  it("is the query as a tag plus the key it spells", () => {
    expect(tagsForQuery("Fantastyka naukowa", LIST)).toEqual([
      "fantastyka naukowa",
      "sci-fi",
    ]);
    expect(tagsForQuery("smok", LIST)).toEqual(["smok"]);
    expect(tagsForQuery("", LIST)).toEqual([]);
  });
});

describe("labelOf", () => {
  it("gives the label in the language, null for an own tag", () => {
    expect(labelOf("crime", LIST, "pl")).toBe("Kryminał");
    expect(labelOf("crime", LIST, "en")).toBe("Crime");
    expect(labelOf("draft", LIST, "en")).toBeNull();
  });
});

describe("validatePredefinedTag", () => {
  it("accepts a new entry and an update of the same key", () => {
    const entry = { key: "horror", labels: { en: "Horror", pl: "Horror" } };
    expect(validatePredefinedTag(entry, LIST)).toBeNull();
    expect(
      validatePredefinedTag(
        { key: "crime", labels: { en: "Crime story", pl: "Kryminał" } },
        LIST,
      ),
    ).toBeNull();
  });

  it("refuses a key that is not normalized", () => {
    expect(
      validatePredefinedTag({ key: "Horror", labels: { en: "H", pl: "H" } }, LIST),
    ).toEqual({ key: "tagKeyNotNormalized", values: { key: "horror" } });
  });

  it("refuses empty and too long labels", () => {
    expect(
      validatePredefinedTag({ key: "x", labels: { en: "X", pl: " " } }, LIST),
    ).toEqual({ key: "tagLabelRequired" });
    expect(
      validatePredefinedTag(
        { key: "x", labels: { en: "X".repeat(31), pl: "X" } },
        LIST,
      ),
    ).toMatchObject({ key: "tagLabelTooLong" });
  });

  it("refuses a spelling another key already has", () => {
    expect(
      validatePredefinedTag(
        { key: "mystery", labels: { en: "Mystery", pl: "kryminał" } },
        LIST,
      ),
    ).toEqual({ key: "tagSpellingTaken", values: { key: "crime" } });
    expect(
      validatePredefinedTag(
        { key: "science fiction", labels: { en: "SF", pl: "SF" } },
        LIST,
      ),
    ).toEqual({ key: "tagSpellingTaken", values: { key: "sci-fi" } });
  });
});

describe("matchingSuggestions", () => {
  const choices = [
    { tag: "sci-fi", text: "Science fiction" },
    { tag: "flash fiction", text: "Flash fiction" },
    { tag: "crime", text: "Kryminał" },
    { tag: "fiction notes", text: "fiction notes" },
  ];

  it("keeps choices whose tag or label contains the text, in order", () => {
    expect(
      matchingSuggestions("  FICT ", choices).map(({ tag }) => tag),
    ).toEqual(["sci-fi", "flash fiction", "fiction notes"]);
    expect(matchingSuggestions("kryminał", choices)).toEqual([choices[2]]);
    expect(matchingSuggestions("crim", choices)).toEqual([choices[2]]);
  });

  it("suggests nothing for empty input and caps the list", () => {
    expect(matchingSuggestions(" ", choices)).toEqual([]);
    const many = Array.from({ length: 20 }, (_, index) => ({
      tag: `t${index}`,
      text: `t${index}`,
    }));
    expect(matchingSuggestions("t", many)).toHaveLength(MAX_SUGGESTIONS);
  });
});
