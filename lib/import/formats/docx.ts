import mammoth from "mammoth";
import { structureMarkdown, type ImportedFile } from "../document";
import { assertUnpackedSize } from "../files";
import { htmlToMarkdown } from "../html";

// The document title is the h1, as in the other formats.
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h3:fresh",
  "p[style-name='Heading 3'] => h4:fresh",
  "p[style-name='Heading 4'] => h5:fresh",
  "p[style-name='Heading 5'] => h6:fresh",
];

export async function readDocx(
  bytes: Uint8Array,
  fallbackTitle: string,
): Promise<ImportedFile> {
  assertUnpackedSize(bytes);
  const { value } = await mammoth.convertToHtml(
    // The browser build reads arrayBuffer, the Node one used by tests reads buffer.
    { arrayBuffer: bytes.slice().buffer, buffer: bytes } as {
      arrayBuffer: ArrayBuffer;
    },
    { styleMap: STYLE_MAP },
  );
  return structureMarkdown(htmlToMarkdown(value), fallbackTitle, {
    shifted: true,
  });
}
