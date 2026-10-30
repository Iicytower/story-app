import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { exportFileName, toMarkdownExport } from "./export";

const story = {
  title: "Title",
  content: "Body",
  notes: "",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-06T12:30:00.000Z",
};

function split(file: string) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(file);
  if (!match) throw new Error("No frontmatter");
  return { data: parse(match[1]) as Record<string, unknown>, body: match[2] };
}

describe("toMarkdownExport", () => {
  it("writes frontmatter with all fields followed by the content", () => {
    expect(split(toMarkdownExport(story))).toEqual({
      data: {
        title: "Title",
        createdAt: "2026-10-01T08:00:00.000Z",
        updatedAt: "2026-10-06T12:30:00.000Z",
        notes: "",
      },
      body: "Body",
    });
  });

  it.each([
    ["quotes", `He said "hi" and 'bye'`],
    ["colons and hashes", "Part 1: the end # not a comment"],
    ["YAML-like values", "true"],
    ["numbers", "2026"],
    ["leading dashes", "--- not a separator"],
    ["leading indicators", "- [a] {b} & *c ! | > % @ `"],
    ["backslashes", "C:\\path\\n"],
    ["multiline text", "line one\nline two\n\n  indented\n---\nafter"],
    [
      "control and Unicode separators",
      "a\tb\u0001c\u007fd\u0085e\u2028f\ufeff",
    ],
    ["Polish characters", "Zażółć gęślą jaźń"],
    ["empty string", ""],
    ["whitespace only", "  \n "],
  ])("round-trips %s in title and notes", (_, value) => {
    const { data } = split(
      toMarkdownExport({ ...story, title: value, notes: value }),
    );
    expect(data.title).toBe(value);
    expect(data.notes).toBe(value);
  });


  it("keeps HTML comments in the content", () => {
    const content = "Visible <!-- hidden -->\n<!--\nmulti\n-->";
    expect(split(toMarkdownExport({ ...story, content })).body).toBe(content);
  });
});

describe("exportFileName", () => {
  it("transliterates Polish characters", () => {
    expect(exportFileName("Zażółć gęślą jaźń")).toBe("zazolc-gesla-jazn.md");
    expect(exportFileName("ŁĄKA ŚĆŻŹŃÓĘ")).toBe("laka-sczznoe.md");
  });

  it("strips other diacritics", () => {
    expect(exportFileName("Café Müller")).toBe("cafe-muller.md");
  });

  it("replaces special characters with single dashes", () => {
    expect(exportFileName(`  A/B\\C: "D"? <E>*|  `)).toBe("a-b-c-d-e.md");
    expect(exportFileName("../../etc/passwd")).toBe("etc-passwd.md");
  });

  it("falls back when nothing safe is left", () => {
    expect(exportFileName("?!*")).toBe("story.md");
    expect(exportFileName("日本語")).toBe("story.md");
  });

  it("limits the length", () => {
    const name = exportFileName("a".repeat(99) + " " + "b".repeat(50));
    expect(name).toBe("a".repeat(99) + ".md");
  });
});
