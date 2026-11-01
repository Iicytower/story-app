import { describe, expect, it } from "vitest";
import { buildPublicFilter, matchesPublicText } from "./search";

const FOLDERS = [
  { _id: "a", tags: ["fantasy"] },
  { _id: "b", tags: [] },
];

describe("buildPublicFilter", () => {
  it("always limits to public, active chapters of the given folders", () => {
    expect(buildPublicFilter("", [], FOLDERS)).toEqual({
      folderId: { $in: ["a", "b"] },
      publication: "public",
      deletedAt: null,
    });
  });

  it("searches title, content and tags, on the chapter or its folder", () => {
    const { $or } = buildPublicFilter(" Fantasy ", [], FOLDERS) as {
      $or: Record<string, unknown>[];
    };
    expect($or.slice(2)).toEqual([
      { tags: "fantasy" },
      { folderId: { $in: ["a"] } },
    ]);
  });

  it("treats the query as text, not a pattern", () => {
    const { $or } = buildPublicFilter("a.*", [], FOLDERS) as {
      $or: { title?: RegExp }[];
    };
    expect($or[0].title!.test("abc")).toBe(false);
    expect($or[0].title!.test("xa.*x")).toBe(true);
  });

  it("requires every selected tag", () => {
    const { $and } = buildPublicFilter("", ["fantasy", "smok"], FOLDERS);
    expect($and).toEqual([
      { $or: [{ tags: "fantasy" }, { folderId: { $in: ["a"] } }] },
      { $or: [{ tags: "smok" }, { folderId: { $in: [] } }] },
    ]);
  });
});

describe("matchesPublicText", () => {
  const chapter = {
    title: "Łąka",
    text: "Zielona trawa",
    tags: ["złoty wiek"],
  };

  it("accepts a hit in the title, text or a whole tag", () => {
    expect(matchesPublicText("ŁĄKA", chapter)).toBe(true);
    expect(matchesPublicText("trawa", chapter)).toBe(true);
    expect(matchesPublicText("Złoty  Wiek", chapter)).toBe(true);
  });

  it("refuses text found nowhere and part of a tag", () => {
    expect(matchesPublicText("smok", chapter)).toBe(false);
    expect(matchesPublicText("złoty", chapter)).toBe(false);
  });

  it("accepts anything without a query", () => {
    expect(matchesPublicText("", chapter)).toBe(true);
  });
});
