import { describe, expect, it } from "vitest";
import { buildSnippet, buildStoryFilter, escapeRegex } from "./search";

describe("escapeRegex", () => {
  it("escapes every regex metacharacter", () => {
    const phrase = ".*+?^$" + "{}()|[]\\x";
    const regex = new RegExp(escapeRegex(phrase));
    expect(regex.test(`a${phrase}b`)).toBe(true);
    expect(regex.test("abc")).toBe(false);
  });

  it("leaves plain text unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });
});

describe("buildSnippet", () => {
  const filler = (char: string) => char.repeat(150);

  it("returns the start of the content without a query", () => {
    expect(buildSnippet("Once upon\n\na time")).toEqual({
      before: "Once upon a time",
      match: "",
      after: "",
    });
  });

  it("truncates a long preview with an ellipsis", () => {
    const snippet = buildSnippet("x".repeat(300));
    expect(snippet.before).toBe(`${"x".repeat(200)}…`);
  });

  it("highlights a match at the start of the content", () => {
    expect(buildSnippet(`Dragon ${filler("a")}`, "dragon")).toEqual({
      before: "",
      match: "Dragon",
      after: ` ${"a".repeat(79)}…`,
    });
  });

  it("shows context on both sides of a match in the middle", () => {
    const snippet = buildSnippet(
      `${filler("a")} dragon ${filler("b")}`,
      "DRAGON",
    );
    expect(snippet).toEqual({
      before: `…${"a".repeat(79)} `,
      match: "dragon",
      after: ` ${"b".repeat(79)}…`,
    });
  });

  it("has no trailing ellipsis for a match at the end", () => {
    expect(buildSnippet(`${filler("a")} dragon`, "dragon")).toEqual({
      before: `…${"a".repeat(79)} `,
      match: "dragon",
      after: "",
    });
  });

  it("falls back to the start of the content when only the title matched", () => {
    expect(buildSnippet("No hit here", "dragon")).toEqual({
      before: "No hit here",
      match: "",
      after: "",
    });
  });

  it("matches regex metacharacters literally", () => {
    expect(buildSnippet("a (b) c", "(b)").match).toBe("(b)");
    expect(buildSnippet("abc", ".*").match).toBe("");
  });

  it("collapses newlines in the context", () => {
    expect(buildSnippet("line one\nline two", "two")).toEqual({
      before: "line one line ",
      match: "two",
      after: "",
    });
  });
});

describe("buildStoryFilter", () => {
  const folders = [
    { _id: "f1", tags: ["a", "b"] },
    { _id: "f2", tags: ["b"] },
    { _id: "f3" },
  ];

  it("always scopes to the user and active stories", () => {
    expect(buildStoryFilter("u", undefined, [], folders)).toEqual({
      userId: "u",
      deletedAt: null,
    });
  });

  it("requires every tag, on the chapter or on its folder", () => {
    expect(buildStoryFilter("u", undefined, ["a", "b"], folders).$and).toEqual([
      { $or: [{ tags: "a" }, { folderId: { $in: ["f1"] } }] },
      { $or: [{ tags: "b" }, { folderId: { $in: ["f1", "f2"] } }] },
    ]);
  });

  it("keeps the search next to the tag conditions", () => {
    const filter = buildStoryFilter("u", "smok", ["a"], folders);
    expect(filter.$or).toHaveLength(2);
    expect(filter.$and).toHaveLength(1);
  });
});
