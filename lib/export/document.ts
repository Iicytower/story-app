import {
  type DocumentLabels,
  ENGLISH_DOCUMENT_LABELS,
} from "@/lib/i18n/english";
import { stripComments } from "@/lib/stories/strip-comments";
import { parseBlocks, type Block } from "./blocks";

export type ExportSource = {
  kind: "story" | "folder";
  title: string;
  notes: string;
  chapters: { title: string; content: string; notes: string }[];
  // A folder's cover (task 26), loaded by the browser for the formats with a title page.
  coverUrl?: string;
};

export type ExportSection = { title: string | null; blocks: Block[] };

// cover: a 600x900 JPEG, since the .docx and .pdf libraries take no WebP (task 26).
export type ExportDocument = {
  title: string;
  sections: ExportSection[];
  cover?: Uint8Array;
};

const notesHeading = (text: string): Block => ({
  type: "heading",
  level: 2,
  spans: [{ text }],
});

// A story's title is the document title, so its only section stays untitled.
export function toExportDocument(
  source: ExportSource,
  includeExtras: boolean,
  labels: DocumentLabels = ENGLISH_DOCUMENT_LABELS,
  cover?: Uint8Array,
): ExportDocument {
  const sections: ExportSection[] = source.chapters.map((chapter) => {
    const blocks = parseBlocks(
      includeExtras ? chapter.content : stripComments(chapter.content),
    );
    if (includeExtras && chapter.notes.trim()) {
      blocks.push(notesHeading(labels.notes), ...parseBlocks(chapter.notes));
    }
    return {
      title: source.kind === "folder" ? chapter.title : null,
      blocks,
    };
  });
  if (includeExtras && source.notes.trim()) {
    sections.push({
      title: labels.folderNotes,
      blocks: parseBlocks(source.notes),
    });
  }
  return { title: source.title, sections, ...(cover && { cover }) };
}
