import { ImportError, type ImportedFile } from "./document";
import { decodeText, unzip } from "./files";

export const IMPORT_EXTENSIONS = [
  "md",
  "txt",
  "html",
  "docx",
  "odt",
  "pdf",
  "epub",
  "fb2",
  "zip",
];

const split = (name: string) => {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot === -1
    ? { base, extension: "" }
    : {
        base: base.slice(0, dot),
        extension: base.slice(dot + 1).toLowerCase(),
      };
};

async function readFile(
  extension: string,
  bytes: Uint8Array,
  title: string,
): Promise<ImportedFile> {
  switch (extension) {
    case "md":
    case "markdown": {
      const { readMarkdown } = await import("./formats/text");
      return readMarkdown(decodeText(bytes), title);
    }
    case "txt": {
      const { readTxt } = await import("./formats/text");
      return readTxt(decodeText(bytes), title);
    }
    case "html":
    case "htm": {
      const [{ structureMarkdown }, { htmlToMarkdown }] = await Promise.all([
        import("./document"),
        import("./html"),
      ]);
      return structureMarkdown(htmlToMarkdown(decodeText(bytes)), title, {
        shifted: true,
      });
    }
    case "docx": {
      const { readDocx } = await import("./formats/docx");
      return readDocx(bytes, title);
    }
    case "odt": {
      const { readOdt } = await import("./formats/odt");
      return readOdt(bytes, title);
    }
    case "pdf": {
      const { readPdf } = await import("./formats/pdf");
      return readPdf(bytes, title);
    }
    case "epub": {
      const { readEpub } = await import("./formats/epub");
      return readEpub(bytes, title);
    }
    case "fb2": {
      const { readFb2 } = await import("./formats/fb2");
      return readFb2(decodeText(bytes), title);
    }
    default:
      throw new ImportError(
        `Unsupported file type: ${extension ? `.${extension}` : "none"}.`,
      );
  }
}

async function readZip(
  bytes: Uint8Array,
  fallbackTitle: string,
): Promise<ImportedFile> {
  const entries = Object.entries(unzip(bytes))
    .filter(([name, data]) => data.length && !name.startsWith("__MACOSX/"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const file: ImportedFile = {
    title: fallbackTitle,
    chapters: [],
    unsplit: null,
    folderNotes: "",
    lossy: false,
  };
  for (const [name, data] of entries) {
    const { base, extension } = split(name);
    if (!IMPORT_EXTENSIONS.includes(extension) || extension === "zip") continue;
    const entry = await readFile(extension, data, base);
    file.lossy ||= entry.lossy;
    if (base === "notes") {
      file.title = entry.title;
      file.folderNotes = (entry.unsplit ?? entry.chapters[0]).content;
    } else {
      file.chapters.push(...(entry.unsplit ? [entry.unsplit] : entry.chapters));
    }
  }
  return file;
}

// Everything happens in the browser; the Server Action only ever receives the text.
export async function parseImportFile(
  name: string,
  bytes: Uint8Array,
): Promise<ImportedFile> {
  const { base, extension } = split(name);
  const file =
    extension === "zip"
      ? await readZip(bytes, base)
      : await readFile(extension, bytes, base);
  const empty = file.chapters.every(
    ({ content, notes }) => !content.trim() && !notes.trim(),
  );
  if (empty) throw new ImportError("This file has no text to import.");
  return file;
}
