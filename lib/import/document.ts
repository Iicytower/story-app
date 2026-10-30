import { marked, type Token, type Tokens } from "marked";
import { parseBlocks, spansText } from "@/lib/export/blocks";
import { MAX_IMPORT_TITLE_LENGTH, type ImportedChapter } from "./limits";

export type ImportedFile = {
  title: string;
  chapters: ImportedChapter[];
  // The same text as one chapter; set only when chapters were guessed from headings.
  unsplit: ImportedChapter | null;
  folderNotes: string;
  // The format cannot keep the formatting, which the dialog warns about.
  lossy: boolean;
};

export class ImportError extends Error {}

const NOTES = "Notes";
const FOLDER_NOTES = "Folder notes";

const cleanTitle = (title: string, fallback: string) =>
  (title.trim() || fallback).slice(0, MAX_IMPORT_TITLE_LENGTH).trim();

const isHeading = (token: Token, depth?: number): token is Tokens.Heading =>
  token.type === "heading" &&
  (depth === undefined || (token as Tokens.Heading).depth === depth);

function headingText(token: Tokens.Heading): string {
  const [block] = parseBlocks(token.raw);
  return block?.type === "heading" ? spansText(block.spans) : token.text;
}

function toMarkdown(tokens: Token[], drop: number): string {
  return tokens
    .map((token) =>
      isHeading(token)
        ? token.raw.replace(/^#+/, "#".repeat(Math.max(1, token.depth - drop)))
        : token.raw,
    )
    .join("")
    .trim();
}

function toChapter(title: string, tokens: Token[], drop: number) {
  // Notes are appended last, so a "Notes" heading in the story itself stays in the text.
  const index = tokens.findLastIndex(
    (token) => isHeading(token) && headingText(token) === NOTES,
  );
  if (index === -1) {
    return { title, content: toMarkdown(tokens, drop), notes: "" };
  }
  return {
    title,
    content: toMarkdown(tokens.slice(0, index), drop),
    notes: toMarkdown(tokens.slice(index + 1), drop),
  };
}

// Exports put the chapter title one level below the document title and the text's
// own headings below that, so `shifted` formats get them back to their source level.
export function structureMarkdown(
  markdown: string,
  fallbackTitle: string,
  { shifted, lossy = false }: { shifted: boolean; lossy?: boolean },
): ImportedFile {
  const tokens = marked.lexer(markdown, { breaks: true, gfm: true });
  const start = tokens.findIndex((token) => token.type !== "space");
  const first: Token | undefined = tokens[start];
  const firstLevel = tokens.filter((token) => isHeading(token, 1));
  const hasSecondLevel = tokens.some((token) => isHeading(token, 2));
  const opensWithTitle = first !== undefined && isHeading(first, 1);
  const titled = opensWithTitle && (firstLevel.length === 1 || hasSecondLevel);
  const title = titled
    ? cleanTitle(headingText(first), fallbackTitle)
    : fallbackTitle;
  const chapterDepth = titled || firstLevel.length < 2 ? 2 : 1;
  const body = tokens.slice(opensWithTitle ? start + 1 : 0);
  const drop = shifted ? chapterDepth : 0;

  const lastChapter = body.findLastIndex((token) =>
    isHeading(token, chapterDepth),
  );
  const closing = body[lastChapter];
  const hasFolderNotes =
    closing !== undefined &&
    isHeading(closing) &&
    headingText(closing) === FOLDER_NOTES;
  const text = hasFolderNotes ? body.slice(0, lastChapter) : body;
  const folderNotes = hasFolderNotes
    ? toMarkdown(body.slice(lastChapter + 1), drop)
    : "";

  const parts: { title: string; tokens: Token[] }[] = [];
  const intro: Token[] = [];
  if (!titled && opensWithTitle) {
    parts.push({ title: headingText(first), tokens: [] });
  }
  for (const token of text) {
    if (isHeading(token, chapterDepth)) {
      parts.push({ title: headingText(token), tokens: [] });
    } else {
      (parts[parts.length - 1]?.tokens ?? intro).push(token);
    }
  }

  const chapters = parts.map((part, index) =>
    toChapter(
      cleanTitle(part.title, `Chapter ${index + 1}`),
      part.tokens,
      drop,
    ),
  );
  if (intro.some((token) => token.type !== "space")) {
    chapters.unshift(toChapter(title, intro, drop));
  }
  const whole = toChapter(
    opensWithTitle ? cleanTitle(headingText(first), fallbackTitle) : title,
    text,
    shifted && opensWithTitle ? 1 : 0,
  );
  return chapters.length < 2
    ? {
        title: whole.title,
        chapters: [whole],
        unsplit: null,
        folderNotes,
        lossy,
      }
    : { title, chapters, unsplit: whole, folderNotes, lossy };
}

// For formats that store each chapter separately, so nothing has to be guessed.
export function fromSections(
  title: string,
  sections: ImportedChapter[],
  lossy: boolean,
): ImportedFile {
  const notes = sections.find((section) => section.title === FOLDER_NOTES);
  return {
    title,
    chapters: sections.filter((section) => section !== notes),
    unsplit: null,
    folderNotes: notes?.content ?? "",
    lossy,
  };
}
