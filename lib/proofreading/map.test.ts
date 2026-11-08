import { getSchema } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { describe, expect, it } from "vitest";
import { contentExtensions, MARKED_OPTIONS } from "@/lib/editor/extensions";
import type { ProofreadIssue } from "./languagetool";
import { placeIssues } from "./map";

const manager = new MarkdownManager({
  extensions: contentExtensions,
  markedOptions: MARKED_OPTIONS,
});
const schema = getSchema(contentExtensions);
const docOf = (markdown: string) =>
  schema.nodeFromJSON(manager.parse(markdown));

// An issue on the first occurrence of `word` in the source (or the nth).
function issueAt(markdown: string, word: string, nth = 0): ProofreadIssue {
  let offset = -1;
  for (let i = 0; i <= nth; i++) offset = markdown.indexOf(word, offset + 1);
  return {
    offset,
    length: word.length,
    kind: "spelling",
    message: "",
    replacements: [],
    ruleId: "TEST",
  };
}

function placed(markdown: string, ...issues: ProofreadIssue[]) {
  const doc = docOf(markdown);
  return placeIssues(markdown, doc, issues).map((item) => ({
    text: doc.textBetween(item.from, item.to),
    original: item.original,
    offset: item.issue.offset,
  }));
}

describe("placeIssues", () => {
  it.each([
    ["plain text", "Ala ma kota i psa.", "kota"],
    ["after a heading", "# Tytuł\n\nPierwszy bląd tutaj.", "bląd"],
    ["inside bold", "To **Napewno** dobrze.", "Napewno"],
    ["after formatting", "**Raz** i _dwa_ Wogóle.", "Wogóle"],
    ["in a link text", "Zobacz [tą stronę](https://a.pl) teraz.", "tą"],
    ["in a list", "- jeden\n- dwa Przyszłem\n- trzy", "Przyszłem"],
    ["in a quote", "> Cytat\n> Mi się podoba", "Mi"],
    ["after a line break", "— Ala\n— Wogóle nie", "Wogóle"],
    ["after a comment", "Przed.\n\n<!-- notatka -->\n\nPo bląd.", "bląd"],
    ["after an escape", "Gwiazdka \\* i bląd.", "bląd"],
    ["after an entity", "Ala &amp; bląd.", "bląd"],
    ["in a dialogue line", "– Nie miły jesteś.", "Nie miły"],
  ])("maps an issue %s to the same text in the document", (_, md, word) => {
    expect(placed(md, issueAt(md, word))).toEqual([
      { text: word, original: word, offset: md.indexOf(word) },
    ]);
  });

  it("drops issues that touch markdown syntax", () => {
    const md = "Ala **ma** kota\ni psa \\* tu.";
    expect(
      placed(
        md,
        { ...issueAt(md, "Ala **ma") },
        { ...issueAt(md, "kota\ni") },
        { ...issueAt(md, "psa \\*") },
      ),
    ).toEqual([]);
  });

  it("drops issues inside comments and URLs, which LT never reads", () => {
    const md = "Tekst [link](https://bląd.pl)\n\n<!-- bląd -->";
    expect(placed(md, issueAt(md, "bląd"), issueAt(md, "bląd", 1))).toEqual([]);
  });

  it("drops empty, out-of-range and overlapping issues", () => {
    const md = "Kot kot siedzi.";
    const first = issueAt(md, "Kot kot");
    expect(
      placed(
        md,
        issueAt(md, "kot siedzi"),
        first,
        { ...first, length: 0 },
        { ...first, offset: md.length - 1, length: 5 },
      ),
    ).toEqual([{ text: "Kot kot", original: "Kot kot", offset: 0 }]);
  });

  it("numbers the placed issues in document order", () => {
    const md = "Ala bląd i Wogóle.";
    const doc = docOf(md);
    const result = placeIssues(md, doc, [
      issueAt(md, "Wogóle"),
      issueAt(md, "bląd"),
    ]);
    expect(result.map(({ id, original }) => [id, original])).toEqual([
      [0, "bląd"],
      [1, "Wogóle"],
    ]);
  });
});
