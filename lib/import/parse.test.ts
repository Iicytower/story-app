import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildChapterFilesZip, buildExport } from "@/lib/export/build";
import { toExportDocument, type ExportSource } from "@/lib/export/document";
import { EXPORT_FORMATS, type ExportFormatId } from "@/lib/export/formats";
import { buildPdf, PDF_FONTS, type PdfFonts } from "@/lib/export/formats/pdf";
import { buildFolderZip } from "@/lib/folders/export";
import { assertUnpackedSize } from "./files";
import { parseImportFile } from "./parse";

const folder: ExportSource = {
  kind: "folder",
  title: "Zażółć & <gęślą>",
  notes: "Sekret folderu",
  chapters: [
    {
      title: "Pierwszy „rozdział”",
      content:
        "# Nagłówek\n\n– Dialog **gruby** i *kursywa*\n\n> Cytat\n\n- jeden\n- dwa\n\n---\n\n[link](https://example.com/?a=1&b=2)",
      notes: "Sekret rozdziału",
    },
    { title: "Drugi", content: 'Tekst & "cudzysłów"', notes: "" },
  ],
};

const story: ExportSource = {
  kind: "story",
  title: "Solo",
  notes: "",
  chapters: [
    {
      title: "Solo",
      content: "Treść opowiadania.",
      notes: "Notatka",
    },
  ],
};

async function pdfFonts() {
  const entries = await Promise.all(
    Object.entries(PDF_FONTS).map(async ([key, file]) => [
      key,
      new Uint8Array(await readFile(join("public/fonts", file))),
    ]),
  );
  return Object.fromEntries(entries) as PdfFonts;
}

async function exported(
  format: ExportFormatId,
  source: ExportSource,
  extras = false,
) {
  const data =
    format === "pdf"
      ? await buildPdf(toExportDocument(source, extras), await pdfFonts())
      : await buildExport(format, source, extras);
  return typeof data === "string" ? strToU8(data) : data;
}

const STRUCTURED = EXPORT_FORMATS.map(({ id }) => id).filter(
  (id) => id !== "pdf",
);

describe("export → import", () => {
  it.each(STRUCTURED)("%s keeps the chapters of a folder", async (format) => {
    const file = await parseImportFile(
      `export.${format}`,
      await exported(format, folder),
    );
    expect(file.title).toBe(folder.title);
    expect(file.chapters.map(({ title }) => title)).toEqual([
      "Pierwszy „rozdział”",
      "Drugi",
    ]);
    const [first, second] = file.chapters;
    if (format === "txt") {
      expect(first.content).toContain("Dialog gruby i kursywa");
    } else {
      expect(first.content).toContain("# Nagłówek");
      expect(first.content).toContain("**gruby**");
      expect(first.content).toContain("*kursywa*");
    }
    expect(first.content).toContain("Cytat");
    expect(first.content).toContain("jeden");
    if (format !== "txt") {
      expect(first.content).toContain("https://example.com/?a=1");
    }
    expect(second.content).toContain('Tekst & "cudzysłów"');
  });

  it.each(["html", "docx", "odt", "md", "txt"] as const)(
    "%s offers the text as one chapter",
    async (format) => {
      const { unsplit } = await parseImportFile(
        `export.${format}`,
        await exported(format, folder),
      );
      expect(unsplit?.title).toBe(folder.title);
      expect(unsplit?.content).toContain("Drugi");
      expect(unsplit?.content).toContain("Tekst");
    },
  );

  it.each(STRUCTURED)(
    "%s keeps a single story as one chapter",
    async (format) => {
      const file = await parseImportFile(
        `export.${format}`,
        await exported(format, story),
      );
      expect(file.title).toBe("Solo");
      expect(file.chapters).toHaveLength(1);
      expect(file.unsplit).toBeNull();
      expect(file.chapters[0].content).toContain("Treść opowiadania.");
    },
  );

  it.each(STRUCTURED)(
    "%s brings chapter and folder notes back",
    async (format) => {
      const file = await parseImportFile(
        `export.${format}`,
        await exported(format, folder, true),
      );
      expect(file.chapters).toHaveLength(2);
      expect(file.chapters[0].notes).toContain("Sekret rozdziału");
      expect(file.chapters[0].content).not.toContain("Sekret rozdziału");
      expect(file.folderNotes).toContain("Sekret folderu");
    },
  );

  it.each(["html", "docx", "odt", "epub"] as const)(
    "%s restores the level of a story's own heading",
    async (format) => {
      const source = {
        ...story,
        chapters: [
          { title: "Solo", content: "# Podtytuł\n\nTekst", notes: "" },
        ],
      };
      const { unsplit, chapters } = await parseImportFile(
        `export.${format}`,
        await exported(format, source),
      );
      expect((unsplit ?? chapters[0]).content).toBe("# Podtytuł\n\nTekst");
    },
  );

  it("offers a story .md with its own first-level heading as one chapter", async () => {
    const source = {
      ...story,
      chapters: [{ title: "Solo", content: "# Podtytuł\n\nTekst", notes: "" }],
    };
    const { unsplit } = await parseImportFile(
      "export.md",
      await exported("md", source),
    );
    expect(unsplit).toEqual({
      title: "Solo",
      content: "# Podtytuł\n\nTekst",
      notes: "",
    });
  });

  it("reads a PDF as one chapter, with paragraphs and a warning", async () => {
    const long = `${"Długi akapit ".repeat(40).trim()}.`;
    const file = await parseImportFile(
      "export.pdf",
      await exported(
        "pdf",
        {
          ...story,
          chapters: [
            { title: "Solo", content: `${long}\n\nDrugi akapit.`, notes: "N" },
          ],
        },
        true,
      ),
    );
    expect(file.lossy).toBe(true);
    expect(file.title).toBe("Solo");
    expect(file.chapters).toHaveLength(1);
    expect(file.chapters[0].content).toBe(`${long}\n\nDrugi akapit.`);
    expect(file.chapters[0].notes).toBe("N");
  });

  it("reads a raw .zip export with notes and frontmatter", async () => {
    const dates = { createdAt: "2026-01-01", updatedAt: "2026-01-02" };
    const zip = buildFolderZip({
      name: "Folder",
      notes: "Notatki folderu",
      createdAt: dates.createdAt,
      notesUpdatedAt: dates.updatedAt,
      chapters: Array.from({ length: 11 }, (_, index) => ({
        title: `Rozdział: ${index + 1}`,
        content: `Treść ${index + 1}`,
        notes: `Notatka ${index + 1}`,
        ...dates,
      })),
    });
    const file = await parseImportFile("folder.zip", zip);
    expect(file.title).toBe("Folder");
    expect(file.folderNotes).toBe("Notatki folderu");
    expect(file.chapters.map(({ title }) => title)).toEqual(
      Array.from({ length: 11 }, (_, index) => `Rozdział: ${index + 1}`),
    );
    expect(file.chapters[1]).toEqual({
      title: "Rozdział: 2",
      content: "Treść 2",
      notes: "Notatka 2",
    });
  });

  it.each(STRUCTURED)(
    "%s chapter files come back from a .zip",
    async (format) => {
      const zip = await buildChapterFilesZip(format, folder, true);
      const file = await parseImportFile("folder.zip", zip);
      expect(file.title).toBe(folder.title);
      expect(file.chapters.map(({ title }) => title)).toEqual([
        "Pierwszy „rozdział”",
        "Drugi",
      ]);
      expect(file.folderNotes).toContain("Sekret folderu");
    },
  );
});

describe("parseImportFile", () => {
  it("rejects a file type that is not supported", async () => {
    await expect(parseImportFile("a.exe", new Uint8Array(1))).rejects.toThrow(
      "Unsupported file type: .exe.",
    );
  });

  it("rejects a file without text", async () => {
    await expect(parseImportFile("a.txt", strToU8(""))).rejects.toThrow(
      "no text",
    );
  });

  it("rejects a zip that would unpack to too much data", async () => {
    const zip = zipSync({ a: new Uint8Array(1000), b: new Uint8Array(1000) });
    expect(() => assertUnpackedSize(zip, 1500)).toThrow("too large");
    expect(() => assertUnpackedSize(zip, 2000)).not.toThrow();
  });

  it("uses the file name when the document has no title", async () => {
    const file = await parseImportFile("moje.md", strToU8("Sam tekst"));
    expect(file.title).toBe("moje");
    expect(file.chapters[0]).toEqual({
      title: "moje",
      content: "Sam tekst",
      notes: "",
    });
  });

  it("splits at first-level headings when there is no document title", async () => {
    const file = await parseImportFile(
      "a.md",
      strToU8("# Raz\n\nA\n\n# Dwa\n\nB"),
    );
    expect(file.chapters.map(({ title }) => title)).toEqual(["Raz", "Dwa"]);
    expect(file.unsplit?.content).toContain("# Dwa");
  });

  it("keeps text before the first chapter", async () => {
    const file = await parseImportFile(
      "a.md",
      strToU8("# T\n\nWstęp\n\n## Raz\n\nA\n\n## Dwa\n\nB"),
    );
    expect(file.chapters.map(({ title }) => title)).toEqual([
      "T",
      "Raz",
      "Dwa",
    ]);
  });

  it("turns escaped dashes in documents into dialogue dashes", async () => {
    const file = await parseImportFile(
      "a.html",
      strToU8("<p>- Dialog</p><p>a<br>b</p>"),
    );
    expect(file.chapters[0].content).toBe("– Dialog\n\na\nb");
  });

  it("reads text in a Polish Windows encoding", async () => {
    const file = await parseImportFile(
      "a.txt",
      new Uint8Array([0xb3, 0xf3, 0x64, 0x9f, 0x0a, 0x0a, 0x61]),
    );
    expect(file.title).toBe("łódź");
  });

  it("drops scripts and images from HTML", async () => {
    const file = await parseImportFile(
      "a.html",
      strToU8('<h1>T</h1><p>Tekst</p><script>x()</script><img src="a.png">'),
    );
    expect(file.chapters[0].content).toBe("Tekst");
  });
});
