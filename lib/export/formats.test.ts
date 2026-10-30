import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseBlocks, splitLines } from "./blocks";
import { buildChapterFilesZip, buildExport } from "./build";
import { toExportDocument, type ExportSource } from "./document";
import { EXPORT_FORMATS } from "./formats";
import { buildPdf, PDF_FONTS, type PdfFonts } from "./formats/pdf";

const folder: ExportSource = {
  kind: "folder",
  title: "Zażółć & <gęślą>",
  notes: "Folder secret",
  chapters: [
    {
      title: "Pierwszy „rozdział”",
      content:
        "# Nagłówek\n\n– Dialog **gruby** i *kursywa*\nnowa linia\n\n<!-- secret comment -->\n\n> Cytat\n\n- jeden\n- dwa\n\n1. raz\n\n---\n\n[link](https://example.com?a=1&b=2) [zły](javascript:alert(1))\n\n<script>alert(1)</script>",
      notes: "Chapter secret",
    },
    { title: "Drugi", content: 'Tekst & "cudzysłów" \u0001', notes: "" },
  ],
};

const story: ExportSource = {
  kind: "story",
  title: "Solo",
  notes: "",
  chapters: [{ title: "Solo", content: "Treść", notes: "" }],
};

const text = (data: Uint8Array | string) =>
  typeof data === "string" ? data : strFromU8(data);

function zipText(data: Uint8Array | string, file: string) {
  return strFromU8(unzipSync(data as Uint8Array)[file]);
}

// Each entry reads the text of a format back, so all share the same expectations.
const readers = {
  txt: text,
  md: text,
  html: text,
  fb2: text,
  odt: (data: Uint8Array | string) => zipText(data, "content.xml"),
  docx: (data: Uint8Array | string) => zipText(data, "word/document.xml"),
  epub: (data: Uint8Array | string) =>
    Object.entries(unzipSync(data as Uint8Array))
      .filter(([name]) => name.includes("chapter-"))
      .map(([, file]) => strFromU8(file))
      .join("\n"),
};

describe.each(Object.keys(readers) as (keyof typeof readers)[])("%s", (id) => {
  it("contains the text and titles in order, without extras by default", async () => {
    const output = readers[id](await buildExport(id, folder, false));
    expect(output).toContain("Pierwszy „rozdział”");
    expect(output.indexOf("Pierwszy")).toBeLessThan(output.indexOf("Drugi"));
    expect(output).toContain("Cytat");
    expect(output).not.toContain("secret");
    // Markdown is the raw source, like the .md export (D10).
    if (id !== "md") expect(output).not.toContain("alert(1)</script>");
  });

  it("includes comments and notes on request", async () => {
    const output = readers[id](await buildExport(id, folder, true));
    expect(output).toContain("secret comment");
    expect(output).toContain("Chapter secret");
    expect(output).toContain("Folder secret");
  });

  it("does not repeat the title of a single story", async () => {
    const output = readers[id](await buildExport(id, story, false));
    expect(output).toContain("Treść");
    if (id !== "epub") expect(output.match(/Solo/g)!.length).toBeLessThan(3);
  });
});

describe("XML formats", () => {
  it.each(["html", "fb2"] as const)("%s escapes markup", async (id) => {
    const output = text(await buildExport(id, folder, false));
    expect(output).toContain("Zażółć &amp; &lt;gęślą&gt;");
    expect(output).not.toContain("\u0001");
  });

  it("drops disallowed links and keeps allowed ones", async () => {
    const output = text(await buildExport("html", folder, false));
    expect(output).toContain('href="https://example.com?a=1&amp;b=2"');
    expect(output).not.toContain("javascript:");
  });

  it.each(["odt", "epub"] as const)(
    "%s starts with an uncompressed mimetype",
    async (id) => {
      const data = (await buildExport(id, folder, false)) as Uint8Array;
      expect(Object.keys(unzipSync(data))[0]).toBe("mimetype");
      expect(strFromU8(data.subarray(30, 38))).toBe("mimetype");
      expect(strFromU8(data.subarray(38, 58))).toContain("application/");
    },
  );

  it("adds every chapter to the EPUB contents", async () => {
    const data = await buildExport("epub", folder, false);
    const nav = zipText(data, "OEBPS/nav.xhtml");
    expect(nav).toContain('href="chapter-1.xhtml"');
    expect(nav).toContain('href="chapter-2.xhtml"');
  });
});

describe("buildChapterFilesZip", () => {
  const names = async (includeExtras: boolean) =>
    Object.keys(
      unzipSync(await buildChapterFilesZip("docx", folder, includeExtras)),
    );

  it("creates one numbered file per chapter, in folder order", async () => {
    expect(await names(false)).toEqual([
      "01-pierwszy-rozdzial.docx",
      "02-drugi.docx",
    ]);
  });

  it("adds folder notes only with extras", async () => {
    expect(await names(true)).toContain("notes.docx");
  });

  it("keeps each chapter's text in its own file", async () => {
    const files = unzipSync(await buildChapterFilesZip("txt", folder, false));
    const second = strFromU8(files["02-drugi.txt"]);
    expect(second).toContain("Tekst");
    expect(second).not.toContain("Cytat");
  });
});

describe("pdf", () => {
  async function fonts() {
    const entries = await Promise.all(
      Object.entries(PDF_FONTS).map(async ([name, file]) => [
        name,
        new Uint8Array(await readFile(join("public/fonts", file))),
      ]),
    );
    return Object.fromEntries(entries) as PdfFonts;
  }

  it("creates a PDF with an outline and one page per chapter", async () => {
    const pdf = await buildPdf(toExportDocument(folder, true), await fonts());
    const raw = Buffer.from(pdf).toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(3);
    expect(raw).toContain("/Outlines");
  });
});

describe("parseBlocks", () => {
  it("decodes the same entities a reader would see", () => {
    expect(parseBlocks('A & B "c"')).toEqual([
      { type: "paragraph", spans: [{ text: 'A & B "c"' }] },
    ]);
  });

  it("marks single newlines as line breaks", () => {
    const [block] = parseBlocks("a\nb");
    expect(block).toMatchObject({
      spans: [{ text: "a" }, { lineBreak: true }, { text: "b" }],
    });
  });
});

describe("splitLines", () => {
  it("starts a new line after each break and drops empty lines", () => {
    const [block] = parseBlocks("a **b**\n\u00a0\nc");
    const spans = block.type === "paragraph" ? block.spans : [];
    expect(
      splitLines(spans).map((line) => line.map(({ text }) => text).join("")),
    ).toEqual(["a b", "\u00a0", "c"]);
  });
});

it("offers every format", () => {
  expect(EXPORT_FORMATS.map(({ id }) => id).sort()).toEqual(
    [...Object.keys(readers), "pdf"].sort(),
  );
});
