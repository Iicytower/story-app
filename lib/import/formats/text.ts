import { parse } from "yaml";
import { structureMarkdown, type ImportedFile } from "../document";

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
): ImportedFile {
  const fields = frontmatter(text);
  if (typeof fields?.title !== "string") {
    return structureMarkdown(text, fallbackTitle, { shifted: false });
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

const headed = (text: string) =>
  text.replace(/\n\nNotes\n\n(?![\s\S]*\n\nNotes\n\n)/, "\n\n### Notes\n\n");

// A plain text export separates chapters with two empty lines, the title with one.
export function readTxt(text: string, fallbackTitle: string): ImportedFile {
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
  });
}
