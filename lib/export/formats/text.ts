import { stripComments } from "@/lib/stories/strip-comments";
import { spansText, type Block } from "../blocks";
import type { ExportDocument, ExportSource } from "../document";

function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
        case "heading":
          return spansText(block.spans);
        case "quote":
          return blocksToText(block.blocks).replace(/^/gm, "> ");
        case "list":
          return block.items
            .map((item, index) => {
              const marker = block.ordered ? `${index + 1}. ` : "- ";
              return (
                marker +
                blocksToText(item).replace(
                  /\n/g,
                  `\n${" ".repeat(marker.length)}`,
                )
              );
            })
            .join("\n");
        case "rule":
          return "***";
      }
    })
    .join("\n\n");
}

export function buildTxt({ title, sections }: ExportDocument): string {
  const parts = [title];
  for (const section of sections) {
    if (section.title) parts.push(`\n${section.title}`);
    parts.push(blocksToText(section.blocks));
  }
  return `${parts.join("\n\n")}\n`;
}

// Markdown stays the raw source: going through blocks would normalize it.
export function buildMarkdown(
  source: ExportSource,
  includeExtras: boolean,
): string {
  const parts = [`# ${source.title}`];
  for (const chapter of source.chapters) {
    if (source.kind === "folder") parts.push(`## ${chapter.title}`);
    parts.push(
      includeExtras ? chapter.content : stripComments(chapter.content),
    );
    if (includeExtras && chapter.notes.trim()) {
      parts.push("### Notes", chapter.notes);
    }
  }
  if (includeExtras && source.notes.trim()) {
    parts.push("## Folder notes", source.notes);
  }
  return `${parts.join("\n\n")}\n`;
}
