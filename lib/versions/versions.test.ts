import { describe, expect, it } from "vitest";
import {
  compareVersion,
  numberedTitle,
  textDiff,
  validateVersionName,
  VERSION_NAME_MAX_LENGTH,
} from "./versions";

const chapter = (id: string, content = `${id} content`) => ({
  title: id,
  content,
  notes: "",
});

describe("validateVersionName", () => {
  it("trims the name", () => {
    expect(validateVersionName("  First draft ")).toEqual({
      ok: true,
      name: "First draft",
    });
  });

  it("rejects an empty name", () => {
    expect(validateVersionName("   ")).toMatchObject({
      ok: false,
      error: "EMPTY_NAME",
    });
  });

  it("rejects a name over the limit", () => {
    expect(
      validateVersionName("a".repeat(VERSION_NAME_MAX_LENGTH)),
    ).toMatchObject({ ok: true });
    expect(
      validateVersionName("a".repeat(VERSION_NAME_MAX_LENGTH + 1)),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("numberedTitle", () => {
  it("keeps the title first, then adds a number", () => {
    expect([1, 2, 3].map((n) => numberedTitle("Prologue", n))).toEqual([
      "Prologue",
      "Prologue (2)",
      "Prologue (3)",
    ]);
  });
});

describe("compareVersion", () => {
  it("marks chapters as changed, unchanged, deleted and added", () => {
    const { chapters, added } = compareVersion(
      [
        { storyId: "a", ...chapter("a") },
        { storyId: "b", ...chapter("b") },
        { storyId: "c", ...chapter("c") },
      ],
      [
        { id: "d", ...chapter("d") },
        { id: "b", ...chapter("b", "b rewritten") },
        { id: "a", ...chapter("a") },
      ],
    );

    expect(chapters.map(({ storyId, status }) => [storyId, status])).toEqual([
      ["a", "unchanged"],
      ["b", "changed"],
      ["c", "deleted"],
    ]);
    expect(added).toEqual([{ id: "d", title: "d" }]);
  });

  it("compares title, content and notes separately", () => {
    const [changed] = compareVersion(
      [{ storyId: "a", title: "Old", content: "same", notes: "one two" }],
      [{ id: "a", title: "New", content: "same", notes: "one three" }],
    ).chapters;

    expect(changed.status).toBe("changed");
    expect(
      changed.status === "changed" && changed.diffs.map((d) => d.field),
    ).toEqual(["title", "notes"]);
  });
});

describe("textDiff", () => {
  it("marks words removed since the version and added after it", () => {
    expect(textDiff("The cat sat.", "The dog sat.")).toEqual([
      { value: "The ", added: false, removed: false },
      { value: "cat", added: false, removed: true },
      { value: "dog", added: true, removed: false },
      { value: " sat.", added: false, removed: false },
    ]);
  });

  it("keeps line breaks", () => {
    const parts = textDiff("a\nb", "a\n\nb")!;
    expect(parts.map((p) => p.value).join("")).toContain("\n");
    expect(parts.some((p) => p.added)).toBe(true);
  });

  it("gives up on a text rewritten from scratch", () => {
    const words = (prefix: string) =>
      Array.from({ length: 6000 }, (_, i) => `${prefix}${i}`).join(" ");
    expect(textDiff(words("a"), words("b"))).toBeNull();
  });
});
