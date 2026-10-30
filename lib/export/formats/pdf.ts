import PDFDocument from "pdfkit";
import { splitLines, type Block, type Span } from "../blocks";
import type { ExportDocument } from "../document";

export const PDF_FONTS = {
  regular: "DejaVuSerif.ttf",
  bold: "DejaVuSerif-Bold.ttf",
  italic: "DejaVuSerif-Italic.ttf",
  boldItalic: "DejaVuSerif-BoldItalic.ttf",
};

export type PdfFonts = Record<keyof typeof PDF_FONTS, Uint8Array>;

export async function fetchPdfFonts(): Promise<PdfFonts> {
  const entries = await Promise.all(
    Object.entries(PDF_FONTS).map(async ([name, file]) => {
      const response = await fetch(`/fonts/${file}`);
      if (!response.ok) throw new Error(`Font ${file} is unavailable.`);
      return [name, new Uint8Array(await response.arrayBuffer())];
    }),
  );
  return Object.fromEntries(entries);
}

const SIZES = [22, 18, 15, 13, 12];
const BODY_SIZE = 11;
const QUOTE_INDENT = 24;

const fontName = (span: Span): keyof PdfFonts =>
  span.bold && span.italic
    ? "boldItalic"
    : span.bold
      ? "bold"
      : span.italic
        ? "italic"
        : "regular";

function writeSpans(doc: PDFDocument, spans: Span[], indent: number) {
  const x = doc.page.margins.left + indent;
  const width =
    doc.page.width - doc.page.margins.left - doc.page.margins.right - indent;
  doc.x = x;
  const lines = splitLines(spans);
  if (!lines.length) doc.text(" ", { width });
  for (const line of lines) {
    // An empty run would leave pdfkit's "continued" state open.
    const runs = line.filter((span) => span.text);
    runs.forEach((span, index) => {
      doc.font(fontName(span)).text(span.text, {
        width,
        continued: index < runs.length - 1,
        link: span.href,
        underline: Boolean(span.href),
      });
    });
  }
}

function writeBlocks(
  doc: PDFDocument,
  blocks: Block[],
  indent: number,
  headingOffset: number,
) {
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        doc.fontSize(BODY_SIZE);
        writeSpans(doc, block.spans, indent);
        doc.moveDown(0.5);
        break;
      case "heading":
        doc.fontSize(SIZES[block.level + headingOffset]);
        writeSpans(
          doc,
          block.spans.map((span) => ({ ...span, bold: true })),
          indent,
        );
        doc.moveDown(0.5);
        break;
      case "quote":
        writeBlocks(doc, block.blocks, indent + QUOTE_INDENT, headingOffset);
        break;
      case "list":
        block.items.forEach((item, index) => {
          const marker = block.ordered ? `${index + 1}. ` : "• ";
          const [first, ...rest] = item;
          writeBlocks(
            doc,
            first?.type === "paragraph"
              ? [
                  {
                    ...first,
                    spans: [{ text: marker }, ...first.spans],
                  },
                  ...rest,
                ]
              : item,
            indent + QUOTE_INDENT / 2,
            headingOffset,
          );
        });
        break;
      case "rule":
        doc.fontSize(BODY_SIZE).font("regular");
        doc.x = doc.page.margins.left + indent;
        doc.text("* * *", { align: "center" });
        doc.moveDown(0.5);
        break;
    }
  }
}

export function buildPdf(
  { title, sections }: ExportDocument,
  fonts: PdfFonts,
): Promise<Uint8Array> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 64,
    // The default Helvetica is not bundled in the browser build.
    font: null,
    info: { Title: title },
  });
  for (const [name, data] of Object.entries(fonts)) {
    doc.registerFont(name, data);
  }

  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise<Uint8Array>((resolve) => {
    doc.on("end", () => {
      const pdf = new Uint8Array(
        chunks.reduce((size, chunk) => size + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        pdf.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(pdf);
    });
  });

  doc.font("bold").fontSize(SIZES[0]).text(title, { align: "center" });
  doc.moveDown();
  sections.forEach((section, index) => {
    if (section.title) {
      if (index > 0) doc.addPage();
      doc.outline.addItem(section.title);
      doc.font("bold").fontSize(SIZES[1]).text(section.title);
      doc.moveDown(0.5);
    }
    writeBlocks(doc, section.blocks, 0, section.title ? 1 : 0);
  });
  doc.end();
  return finished;
}
