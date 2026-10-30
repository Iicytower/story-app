import { getDocumentProxy, getMeta } from "unpdf";
import { structureMarkdown, type ImportedFile } from "../document";

type TextItem = { str: string; transform: number[]; height: number };

// A gap bigger than this many text heights starts a new paragraph.
const PARAGRAPH_GAP = 1.5;
const SENTENCE_END = /[.!?…:"”»)]$/;

function pageLines(items: TextItem[]) {
  const lines: { y: number; height: number; text: string }[] = [];
  for (const { str, transform, height } of items) {
    if (!str) continue;
    const y = transform[5];
    const line = lines[lines.length - 1];
    // Bold and italic runs of one line sit a fraction of a point apart.
    if (line && Math.abs(line.y - y) < 2) {
      line.text += str;
      line.height = Math.max(line.height, height);
    } else {
      lines.push({ y, height, text: str });
    }
  }
  return lines;
}

export async function readPdf(
  bytes: Uint8Array,
  fallbackTitle: string,
): Promise<ImportedFile> {
  const pdf = await getDocumentProxy(bytes);
  const { info } = await getMeta(pdf);
  const title = typeof info?.Title === "string" ? info.Title.trim() : "";

  const paragraphs: string[] = [];
  let startNew = true;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const { items } = await page.getTextContent();
    const lines = pageLines(items as TextItem[]);
    lines.forEach((line, index) => {
      const previous = lines[index - 1];
      const previousText = paragraphs[paragraphs.length - 1];
      const gap = previous ? previous.y - line.y : 0;
      const paragraphBreak = previous
        ? gap > line.height * PARAGRAPH_GAP
        : SENTENCE_END.test(previousText ?? "");
      if (startNew || paragraphBreak) {
        paragraphs.push(line.text.trim());
        startNew = false;
      } else {
        paragraphs[paragraphs.length - 1] += ` ${line.text.trim()}`;
      }
    });
  }

  if (title && paragraphs[0] === title) paragraphs.shift();
  const notes = paragraphs.lastIndexOf("Notes");
  if (notes !== -1) paragraphs[notes] = "### Notes";
  const markdown = [`# ${title || fallbackTitle}`, ...paragraphs].join("\n\n");
  return structureMarkdown(markdown, fallbackTitle, {
    shifted: false,
    lossy: true,
  });
}
