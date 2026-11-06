import { Lexer, type Token } from "marked";
import { MARKED_OPTIONS } from "@/lib/editor/extensions";

// LanguageTool `data` parameter: text is checked, markup is skipped (or read as interpretAs),
// and match offsets count both, so they point into the markdown source.
export type AnnotationPart =
  { text: string } | { markup: string; interpretAs?: string };

// Lines LT reads as one paragraph give false alarms (task 29, research), so every line break
// and block boundary is a paragraph break for it.
const PARAGRAPH_BREAK = "\n\n";

// Leaves whose source is all markup: separators, code, html (comments), tables, images.
const MARKUP_LEAVES = new Set([
  "space",
  "hr",
  "html",
  "tag",
  "code",
  "codespan",
  "def",
  "table",
  "image",
  "checkbox",
]);

type LexToken = Token & { tokens?: Token[]; items?: Token[] };

function children(token: LexToken): Token[] | undefined {
  return token.type === "list" ? token.items : token.tokens;
}

// Finds each child's source in the parent's, so the gaps (`# `, `**`, `](url)`) are markup.
// Fails where marked lexed a rewritten text (blockquote and list continuation lines).
function walk(token: LexToken, out: AnnotationPart[]): boolean {
  if (token.type === "escape") {
    out.push({ markup: token.raw, interpretAs: token.text });
    return true;
  }
  if (token.type === "br") {
    out.push({ markup: token.raw, interpretAs: PARAGRAPH_BREAK });
    return true;
  }
  if (MARKUP_LEAVES.has(token.type)) {
    out.push({ markup: token.raw });
    return true;
  }
  const nested = children(token);
  if (!nested?.length) {
    out.push({ text: token.raw });
    return true;
  }
  let cursor = 0;
  for (const child of nested) {
    const index = token.raw.indexOf(child.raw, cursor);
    if (index === -1) return false;
    if (index > cursor) out.push({ markup: token.raw.slice(cursor, index) });
    if (!walk(child, out)) return false;
    cursor = index + child.raw.length;
  }
  if (cursor < token.raw.length) out.push({ markup: token.raw.slice(cursor) });
  return true;
}

const LINE_PREFIX = /^[^\S\n]*(?:(?:#{1,6}|>|[-*+]|\d+[.)])[^\S\n]*)*/;
const INLINE_MARKUP = /\]\([^)\n]*\)|[*_~`[\]]+/g;

// For a block the walk cannot map: line prefixes and emphasis runs are markup, the rest text.
function fallback(source: string): AnnotationPart[] {
  return source.split(/(\n)/).flatMap((line): AnnotationPart[] => {
    if (line === "\n") return [{ markup: line }];
    const prefix = line.match(LINE_PREFIX)?.[0] ?? "";
    const parts: AnnotationPart[] = prefix ? [{ markup: prefix }] : [];
    let cursor = prefix.length;
    for (const match of line.slice(prefix.length).matchAll(INLINE_MARKUP)) {
      const index = prefix.length + match.index;
      if (index > cursor) parts.push({ text: line.slice(cursor, index) });
      parts.push({ markup: match[0] });
      cursor = index + match[0].length;
    }
    if (cursor < line.length) parts.push({ text: line.slice(cursor) });
    return parts;
  });
}

const sourceOf = (parts: AnnotationPart[]) =>
  parts.map((part) => ("text" in part ? part.text : part.markup)).join("");

// Newlines in text become markup, and markup with a newline reads as a paragraph break.
function breakParagraphs(part: AnnotationPart): AnnotationPart[] {
  if ("text" in part) {
    return part.text
      .split(/(\n+)/)
      .filter(Boolean)
      .map((piece) =>
        piece.startsWith("\n")
          ? { markup: piece, interpretAs: PARAGRAPH_BREAK }
          : { text: piece },
      );
  }
  if (part.interpretAs === undefined && part.markup.includes("\n")) {
    return [{ markup: part.markup, interpretAs: PARAGRAPH_BREAK }];
  }
  return [part];
}

export function annotateMarkdown(markdown: string): AnnotationPart[] {
  const blocks = new Lexer(MARKED_OPTIONS).lex(markdown);
  let parts = blocks.flatMap((block) => {
    const out: AnnotationPart[] = [];
    return walk(block, out) && sourceOf(out) === block.raw
      ? out
      : fallback(block.raw);
  });
  // The lexer normalizes some input (e.g. \r\n); offsets must still match the stored text.
  if (sourceOf(parts) !== markdown) parts = fallback(markdown);
  return parts.flatMap(breakParagraphs);
}
