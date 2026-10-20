import { strToU8, zipSync } from "fflate";
import {
  safeFileName,
  toMarkdownExport,
  withFrontmatter,
} from "@/lib/stories/export";

type ExportedFolder = {
  name: string;
  notes: string;
  createdAt: string;
  notesUpdatedAt: string;
  chapters: {
    title: string;
    content: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

// The number prefix keeps the folder order in a file manager and makes equal titles unique.
export function folderZipEntries(
  folder: ExportedFolder,
): Record<string, string> {
  const digits = Math.max(2, String(folder.chapters.length).length);
  const entries: Record<string, string> = {};
  folder.chapters.forEach((chapter, index) => {
    const number = String(index + 1).padStart(digits, "0");
    entries[`${number}-${safeFileName(chapter.title, "chapter")}.md`] =
      toMarkdownExport(chapter);
  });
  entries["notes.md"] = withFrontmatter(
    {
      title: folder.name,
      createdAt: folder.createdAt,
      updatedAt: folder.notesUpdatedAt,
    },
    folder.notes,
  );
  return entries;
}

export function buildFolderZip(folder: ExportedFolder): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(folderZipEntries(folder)).map(([name, text]) => [
        name,
        strToU8(text),
      ]),
    ),
  );
}

export function folderZipName(name: string): string {
  return `${safeFileName(name, "folder")}.zip`;
}
