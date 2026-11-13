import { parse } from "yaml";
import { NOTES_HEADINGS } from "@/lib/i18n/english";
import { escapeRegex } from "@/lib/stories/search";
import {
  structureMarkdown,
  type ImportedFile,
  type ChapterTitle,
} from "../document";

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n\n?/;

function frontmatter(text: string): Record<string, unknown> | null {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  try {
    const fields: unknown = parse(match[1]);
    return typeof fields === "object"
      ? (fields as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function readMarkdown(
  text: string,
  fallbackTitle: string,
  chapterTitle?: ChapterTitle,
): ImportedFile {
  const fields = frontmatter(text);
  if (typeof fields?.title !== "string") {
    return structureMarkdown(text, fallbackTitle, {
      shifted: false,
      chapterTitle,
    });
  }
  const title = fields.title.trim() || fallbackTitle;
  const chapter = {
    title,
    content: text.replace(FRONTMATTER, ""),
    notes: typeof fields.notes === "string" ? fields.notes : "",
  };
  return {
    title,
    chapters: [chapter],
    unsplit: null,
    folderNotes: "",
    lossy: false,
  };
}

export function readDescription(text: string): string | undefined {
  const description = frontmatter(text)?.description;
  return typeof description === "string" ? description : undefined;
}

// The last notes heading of any language, as plain text has no heading markup.
const HEADINGS = NOTES_HEADINGS.map(escapeRegex).join("|");
const NOTES_LINE = new RegExp(
  `\\n\\n(${HEADINGS})\\n\\n(?![\\s\\S]*\\n\\n(?:${HEADINGS})\\n\\n)`,
);

const headed = (text: string) => text.replace(NOTES_LINE, "\n\n### $1\n\n");

// A plain text export separates chapters with two empty lines, the title with one.
export function readTxt(
  text: string,
  fallbackTitle: string,
  chapterTitle?: ChapterTitle,
): ImportedFile {
  const [head, ...rest] = text.trim().split(/\n{3,}/);
  const title = (
    rest.length ? /^(.{1,100})(?:\n\n|$)/ : /^(.{1,100})\n\n/
  ).exec(head);
  const opening = title ? head.slice(title[0].length) : head;
  const chapters = rest.map((part) => {
    const [line, ...body] = part.split("\n\n");
    return `## ${line}\n\n${headed(`\n\n${body.join("\n\n")}`).trim()}`;
  });
  const markdown = [
    `# ${title?.[1] ?? fallbackTitle}`,
    headed(`\n\n${opening}`).trim(),
    ...chapters,
  ];
  return structureMarkdown(markdown.join("\n\n"), fallbackTitle, {
    shifted: false,
    chapterTitle,
  });
}
