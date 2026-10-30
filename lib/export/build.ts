import { toExportDocument, type ExportSource } from "./document";
import type { ExportFormatId } from "./formats";

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
