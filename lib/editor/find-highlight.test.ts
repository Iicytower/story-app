import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { contentExtensions } from "./extensions";
import { compileFind } from "./find";
import { docMatches, replaceInDoc } from "./find-highlight";

const schema = getSchema(contentExtensions);
const text = (value: string, marks?: string[]) => ({
  type: "text",
  text: value,
  ...(marks && { marks: marks.map((type) => ({ type })) }),
});
const paragraph = (...content: object[]) => ({ type: "paragraph", content });

const docOf = (...content: object[]) =>
  schema.nodeFromJSON({ type: "doc", content });

const regexFor = (query: string) =>
  compileFind({
    query,
    matchCase: false,
    wholeWord: false,
    regex: false,
  }) as RegExp;

function replaceAll(doc: ReturnType<typeof docOf>, query: string, to: string) {
  const regex = regexFor(query);
  const { tr } = EditorState.create({ doc });
  return replaceInDoc(tr, docMatches(doc, regex), regex, to).doc;
}

describe("docMatches", () => {
  it("finds text across formatting and maps it to document positions", () => {
    const doc = docOf(paragraph(text("ab"), text("cd", ["bold"]), text("e")));
    const [match] = docMatches(doc, regexFor("bcd"));
    expect(doc.textBetween(match.from, match.to)).toBe("bcd");
  });

  it("keeps positions right after a line break", () => {
    const doc = docOf(paragraph(text("a"), { type: "hardBreak" }, text("kot")));
    const [match] = docMatches(doc, regexFor("kot"));
    expect(doc.textBetween(match.from, match.to)).toBe("kot");
  });

  it("does not match across blocks", () => {
    const doc = docOf(paragraph(text("ko")), paragraph(text("t")));
    expect(docMatches(doc, regexFor("kot"))).toEqual([]);
  });

  it("finds text in comments, lists and headings", () => {
    const doc = docOf(
      { type: "comment", content: [text("kot")] },
      { type: "heading", attrs: { level: 1 }, content: [text("kot")] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("kot"))] }],
      },
    );
    expect(docMatches(doc, regexFor("kot"))).toHaveLength(3);
  });
});

describe("replaceInDoc", () => {
  it("replaces all matches", () => {
    const doc = docOf(paragraph(text("kot kot")), paragraph(text("Kot")));
    expect(replaceAll(doc, "kot", "pies").textContent).toBe("pies piespies");
  });

  it("keeps the formatting of the replaced text", () => {
    const doc = docOf(paragraph(text("a "), text("kot", ["bold"])));
    const result = replaceAll(doc, "kot", "pies");
    expect(result.firstChild!.lastChild!.text).toBe("pies");
    expect(result.firstChild!.lastChild!.marks[0].type.name).toBe("bold");
  });

  it("deletes the match with an empty replacement", () => {
    const doc = docOf(paragraph(text("a kot")));
    expect(replaceAll(doc, " kot", "").textContent).toBe("a");
  });

  it("replaces inside a comment", () => {
    const doc = docOf({ type: "comment", content: [text("kot")] });
    const result = replaceAll(doc, "kot", "pies");
    expect(result.firstChild!.type.name).toBe("comment");
    expect(result.textContent).toBe("pies");
  });
});
