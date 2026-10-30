import { MarkdownManager } from "@tiptap/markdown";
import { describe, expect, it } from "vitest";
import {
  contentExtensions,
  isAllowedLink,
  MARKED_OPTIONS,
  trimMarkdown,
} from "./extensions";

// The same conversion the editor runs, without a DOM.
const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});
const roundTrip = (markdown: string) =>
  trimMarkdown(manager.serialize(manager.parse(markdown)));

describe("markdown round trip", () => {
  it.each([
    ["paragraphs and inline marks", "First *italic* and **bold**\n\nSecond"],
    ["headings", "# One\n\n## Two\n\n### Three"],
    ["lists", "- Hello.\n- Hi!\n\n1. First\n2. Second"],
    ["dialogue", "– Hello.\n\n– Hi!\n\n– And you?  \n– Fine."],
    ["quote and horizontal line", "> Quoted\n\n---\n\nAfter"],
    ["links", "[site](https://example.com) and [mail](mailto:a@b.pl)"],
    ["a line break", "first  \nsecond"],
    ["comments", "Text\n\n<!-- a note\nover two lines -->\n\nMore"],
  ])("keeps %s", (_, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("turns a single newline into a line break, as remark-breaks does", () => {
    expect(manager.parse("first\nsecond").content?.[0]).toMatchObject({
      type: "paragraph",
      content: [
        { type: "text", text: "first" },
        { type: "hardBreak" },
        { type: "text", text: "second" },
      ],
    });
    expect(roundTrip("first\nsecond")).toBe("first  \nsecond");
  });

  it("keeps dialogue as paragraphs, not a list", () => {
    expect(manager.parse("– Hello.\n\n– Hi!").content).toMatchObject([
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
  });

  it("saves a hyphen opening a line as a dash, which cannot become a list", () => {
    const text = (value: string) => ({ type: "text", text: value });
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [text("- Hello.")] },
        {
          type: "paragraph",
          content: [text("Who?"), { type: "hardBreak" }, text("- Me.")],
        },
      ],
    };
    const markdown = manager.serialize(doc);
    expect(markdown).toBe("– Hello.\n\nWho?  \n– Me.");
    expect(manager.parse(markdown).content).toMatchObject([
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
  });

  it("parses a comment as an editable block with its text", () => {
    expect(manager.parse("<!--  note  -->").content).toEqual([
      { type: "comment", content: [{ type: "text", text: "note" }] },
    ]);
    expect(manager.parse("<!---->").content).toEqual([
      { type: "comment", content: [] },
    ]);
  });

  it("does not let the comment text close the comment early", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "comment", content: [{ type: "text", text: "a --> b" }] },
      ],
    };
    expect(manager.serialize(doc)).toBe("<!-- a - -> b -->");
  });

  it("leaves a comment marker inside a paragraph as text", () => {
    expect(manager.parse("text <!-- x --> more").content).toMatchObject([
      { type: "paragraph" },
    ]);
  });
});

describe("isAllowedLink", () => {
  it("allows http, https and mailto only", () => {
    expect(isAllowedLink("https://example.com")).toBe(true);
    expect(isAllowedLink("http://example.com/a?b=c")).toBe(true);
    expect(isAllowedLink("mailto:me@example.com")).toBe(true);
    expect(isAllowedLink("javascript:alert(1)")).toBe(false);
    expect(isAllowedLink("JavaScript:alert(1)")).toBe(false);
    expect(isAllowedLink("data:text/html,x")).toBe(false);
    expect(isAllowedLink("example.com")).toBe(false);
  });
});

describe("trimMarkdown", () => {
  it("drops trailing blank lines left by the trailing paragraph", () => {
    expect(trimMarkdown("<!-- a -->\n\n")).toBe("<!-- a -->");
    expect(trimMarkdown("text")).toBe("text");
  });
});
