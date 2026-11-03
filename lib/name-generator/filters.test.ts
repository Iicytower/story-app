import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  effectiveFilters,
  type Filters,
  loadFilters,
  saveFilters,
} from "./filters";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const DAY = 24 * 60 * 60 * 1000;
const filters: Filters = {
  ...DEFAULT_FILTERS,
  sound: "hard",
  styles: ["orcish"],
};

describe("saved filters", () => {
  it("come back as saved", () => {
    const store = memoryStore();
    saveFilters(store, filters, 0);
    expect(loadFilters(store, DAY)).toEqual(filters);
  });

  it("last seven days from the last change", () => {
    const store = memoryStore();
    saveFilters(store, filters, 0);
    expect(loadFilters(store, 7 * DAY)).toEqual(filters);
    expect(loadFilters(store, 7 * DAY + 1)).toEqual(DEFAULT_FILTERS);
  });

  it("fall back to defaults when missing", () => {
    expect(loadFilters(memoryStore(), 0)).toEqual(DEFAULT_FILTERS);
  });

  it.each([
    "{not json",
    "null",
    "[]",
    JSON.stringify({ savedAt: 0 }),
    JSON.stringify({ savedAt: 0, filters: { ...filters, sound: "loud" } }),
    JSON.stringify({
      savedAt: 0,
      filters: { ...filters, styles: ["klingon"] },
    }),
    JSON.stringify({ savedAt: 0, filters: { ...filters, contains: 1 } }),
  ])("fall back to defaults for %s", (value) => {
    const store = memoryStore();
    store.setItem("name-generator-filters", value);
    expect(loadFilters(store, 0)).toEqual(DEFAULT_FILTERS);
  });
});

describe("effectiveFilters", () => {
  it("ignores Gender for a type without a first name", () => {
    const f = effectiveFilters({
      ...DEFAULT_FILTERS,
      type: "city",
      gender: "male",
    });
    expect(f.gender).toBe("any");
  });

  it("fixes the word count of a full name", () => {
    const f = effectiveFilters({
      ...DEFAULT_FILTERS,
      type: "full-name",
      wordCount: "three",
    });
    expect(f.wordCount).toBe("two");
  });

  it("ignores Mix styles with exactly one style", () => {
    const f = effectiveFilters({
      ...DEFAULT_FILTERS,
      styles: ["latin"],
      mixStyles: true,
    });
    expect(f.mixStyles).toBe(false);
  });
});
