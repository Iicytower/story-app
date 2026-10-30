import { MarkdownManager } from "@tiptap/markdown";
import { describe, expect, it } from "vitest";
import { contentExtensions, MARKED_OPTIONS } from "./extensions";
import { blockStarts } from "./source-blocks";

const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});

describe("blockStarts", () => {
  it("points each block at its first character in the source", () => {
    const markdown =
      "First line\nsecond line\n\n# Heading\n\n<!-- note -->\n\n- one\n- two\n\n> quote\n\n---\n\nLast";
    const starts = blockStarts(manager, markdown);
    expect(starts.map((start) => markdown.slice(start).split("\n")[0])).toEqual(
      [
        "First line",
        "# Heading",
        "<!-- note -->",
        "- one",
        "> quote",
        "---",
        "Last",
      ],
    );
  });

  it.each([
    ["extra blank lines", "A\n\n\n\nB\n\n\n\n\n\nC"],
    ["leading and trailing blank lines", "\n\nA\n\n"],
    ["a comment followed by a paragraph", "<!-- c -->\n\nA"],
    ["blank lines after a comment", "<!-- c -->\n\n\n\nA"],
    ["raw html", "<div>x</div>\n\nA"],
    ["an empty paragraph marker", "&nbsp;\n\nA"],
    ["a single block", "Only"],
    ["nothing", ""],
  ])("finds as many blocks as the editor parses for %s", (_, markdown) => {
    expect(blockStarts(manager, markdown)).toHaveLength(
      manager.parse(markdown).content?.length ?? 0,
    );
  });

  it("starts an empty paragraph at the extra blank lines between its neighbours", () => {
    expect(blockStarts(manager, "A\n\n\n\nB")).toEqual([0, 1, 5]);
  });
});
