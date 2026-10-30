export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 300 * 1024 * 1024;
// Below the 4 MB bodySizeLimit, which also has to fit the encoding of the request.
export const MAX_IMPORT_TEXT_BYTES = 3.5 * 1024 * 1024;
export const MAX_IMPORT_CHAPTERS = 500;
export const MAX_IMPORT_TITLE_LENGTH = 200;

export type ImportedChapter = { title: string; content: string; notes: string };

export function importTextBytes(
  chapters: ImportedChapter[],
  folderNotes: string,
): number {
  const encoder = new TextEncoder();
  return chapters.reduce(
    (total, { title, content, notes }) =>
      total + encoder.encode(title + content + notes).length,
    encoder.encode(folderNotes).length,
  );
}
