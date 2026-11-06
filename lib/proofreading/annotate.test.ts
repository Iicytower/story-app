import { describe, expect, it } from "vitest";
import { annotateMarkdown, type AnnotationPart } from "./annotate";

const source = (parts: AnnotationPart[]) =>
  parts.map((part) => ("text" in part ? part.text : part.markup)).join("");

const text = (parts: AnnotationPart[]) =>
  parts.flatMap((part) => ("text" in part ? [part.text] : []));

// What LanguageTool reads: text as is, markup as interpretAs (nothing when missing).
const read = (parts: AnnotationPart[]) =>
  parts
    .map((part) => ("text" in part ? part.text : (part.interpretAs ?? "")))
    .join("");

// Every construct the editor writes, plus ones it can meet in imported text.
const CASES: [string, string][] = [
  ["empty", ""],
  ["paragraph", "Ala ma kota."],
  ["headings", "# Jeden\n\n## Dwa\n\n### Trzy"],
  ["emphasis", "To **jest** _ważne_ i *bardzo* ~~stare~~."],
  ["link", "Zobacz [stronę](https://example.com) teraz."],
  ["line breaks", "Pierwsza linia\nDruga linia  \nTrzecia"],
  ["comment", "Przed.\n\n<!-- notatka autora -->\n\nPo."],
  ["inline comment", "Tekst <!-- uwaga --> dalej."],
  ["quote", "> Cytat w jednej linii\n> i w drugiej."],
  ["lists", "- jeden\n- dwa\n  - zagnieżdżony\n\n1. pierwszy\n2. drugi"],
  ["rule", "Przed\n\n---\n\nPo"],
  ["escape", "Gwiazdka \\* i podkreślnik \\_ zostają."],
  ["code", "Kod `x = 1` i\n\n```\nblok\n```"],
  ["table", "| a | b |\n| - | - |\n| c | d |"],
  ["image", "![opis](obraz.png) obok"],
  ["blank lines", "Jeden\n\n\n\nDwa\n\n"],
  ["dialogue", "— Spoko — rzekł.\n— Będzie git.\n\n— Na pewno?"],
  ["crlf", "Windows\r\nlinie"],
];

describe("annotateMarkdown", () => {
  it.each(CASES)("keeps the source of %s", (_, markdown) => {
    expect(source(annotateMarkdown(markdown))).toBe(markdown);
  });

  it("marks markdown syntax as markup, not text", () => {
    const parts = annotateMarkdown(
      "# Tytuł\n\nPierwszy **bląd** i [link](https://a.pl) _x_.",
    );
    expect(text(parts).join("")).toBe("TytułPierwszy bląd i link x.");
    // "bląd" is at its offset in the source, markers included.
    const offset = source(
      parts.slice(
        0,
        parts.findIndex((p) => "text" in p && p.text === "bląd"),
      ),
    );
    expect(offset.length).toBe("# Tytuł\n\nPierwszy **".length);
  });

  it("leaves comments, code and URLs out of the checked text", () => {
    const checked = read(
      annotateMarkdown("A <!-- b --> c\n\n<!-- d -->\n\n`e` [f](g)"),
    );
    expect(checked).not.toMatch(/[bdeg]/);
  });

  it("reads every line break and block boundary as a new paragraph", () => {
    expect(read(annotateMarkdown("— Ala\n— Ola\n\nKot"))).toBe(
      "— Ala\n\n— Ola\n\nKot",
    );
    expect(read(annotateMarkdown("Ala  \nOla"))).toBe("Ala\n\nOla");
  });

  it("reads escapes as the escaped character", () => {
    expect(read(annotateMarkdown("a \\* b"))).toBe("a * b");
  });

  it("maps continuation lines of quotes and lists to markup", () => {
    const checked = read(annotateMarkdown("> Ala\n> Ola\n\n- a\n  - b"));
    expect(checked).not.toContain(">");
    expect(checked).not.toContain("-");
    expect(checked).toContain("Ala");
    expect(checked).toContain("Ola");
  });
});
