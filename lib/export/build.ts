import { strToU8, zipSync } from "fflate";
import { chapterFileName } from "@/lib/folders/export";
import { toExportDocument, type ExportSource } from "./document";
import { EXPORT_FORMATS, type ExportFormatId } from "./formats";

// Generators are imported on demand so their packages stay out of the page bundle.
export async function buildExport(
  format: ExportFormatId,
  source: ExportSource,
  includeExtras: boolean,
): Promise<Uint8Array | string> {
  const document = toExportDocument(source, includeExtras);
  switch (format) {
    case "md": {
      const { buildMarkdown } = await import("./formats/text");
      return buildMarkdown(source, includeExtras);
    }
    case "txt": {
      const { buildTxt } = await import("./formats/text");
      return buildTxt(document);
    }
    case "html": {
      const { buildHtml } = await import("./formats/html");
      return buildHtml(document);
    }
    case "fb2": {
      const { buildFb2 } = await import("./formats/fb2");
      return buildFb2(document);
    }
    case "epub": {
      const { buildEpub } = await import("./formats/epub");
      return buildEpub(document);
    }
    case "odt": {
      const { buildOdt } = await import("./formats/odt");
      return buildOdt(document);
    }
    case "docx": {
      const { buildDocx } = await import("./formats/docx");
      return buildDocx(document);
    }
    case "pdf": {
      const { buildPdf, fetchPdfFonts } = await import("./formats/pdf");
      return buildPdf(document, await fetchPdfFonts());
    }
  }
}

export async function buildChapterFilesZip(
  format: ExportFormatId,
  source: ExportSource,
  includeExtras: boolean,
): Promise<Uint8Array> {
  const { extension } = EXPORT_FORMATS.find(({ id }) => id === format)!;
  const toBytes = async (title: string, content: string, notes: string) => {
    const data = await buildExport(
      format,
      {
        kind: "story",
        title,
        notes: "",
        chapters: [{ title, content, notes }],
      },
      includeExtras,
    );
    return typeof data === "string" ? strToU8(data) : data;
  };

  const files: Record<string, Uint8Array> = {};
  for (const [index, chapter] of source.chapters.entries()) {
    const { title, content, notes } = chapter;
    const name = chapterFileName(
      title,
      index,
      source.chapters.length,
      extension,
    );
    files[name] = await toBytes(title, content, notes);
  }
  if (includeExtras && source.notes.trim()) {
    files[`notes.${extension}`] = await toBytes(source.title, source.notes, "");
  }
  return zipSync(files);
}
