import { stripComments } from "@/lib/stories/strip-comments";
import { parseBlocks, type Block } from "./blocks";

export type ExportSource = {
  kind: "story" | "folder";
  title: string;
  notes: string;
  chapters: { title: string; content: string; notes: string }[];
};

export type ExportSection = { title: string | null; blocks: Block[] };

export type ExportDocument = { title: string; sections: ExportSection[] };

const notesHeading = (text: string): Block => ({
  type: "heading",
  level: 2,
  spans: [{ text }],
});

// A story's title is the document title, so its only section stays untitled.
export function toExportDocument(
  source: ExportSource,
  includeExtras: boolean,
): ExportDocument {
  const sections: ExportSection[] = source.chapters.map((chapter) => {
    const blocks = parseBlocks(
      includeExtras ? chapter.content : stripComments(chapter.content),
    );
    if (includeExtras && chapter.notes.trim()) {
      blocks.push(notesHeading("Notes"), ...parseBlocks(chapter.notes));
    }
    return {
      title: source.kind === "folder" ? chapter.title : null,
      blocks,
    };
  });
  if (includeExtras && source.notes.trim()) {
    sections.push({
      title: "Folder notes",
      blocks: parseBlocks(source.notes),
    });
  }
  return { title: source.title, sections };
}
