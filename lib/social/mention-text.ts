// Mentions in the text, shared by the server, the markdown render and the textarea (task 82).
export const MAX_MENTIONS = 10;

// The nickname of D37 after an @ not glued to a word, an address (a@b) or a path (/@x).
export const MENTION =
  /(?<![A-Za-z0-9_./@-])@([A-Za-z0-9_-]{3,30})(?![A-Za-z0-9_-])/g;

// Links, autolinks and link definitions, which mentions do not reach. Each part stays within a
// line and stops at the next bracket, so a text full of brackets is read in linear time.
const LINKS = [
  /!?\[[^[\]\n]*\]\([^()\n]*\)/g,
  /!?\[[^[\]\n]*\]\[[^[\]\n]*\]/g,
  /^ {0,3}\[[^[\]\n]+\]:[^\n]*$/gm,
  /<[^<>\s]+>/g,
];

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CLOSING = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const INDENTED = /^(?: {4}|\t)/;

// Inline code: a run of backticks up to the next run of the same length (CommonMark), found
// with one pass over the runs of the line.
function withoutInlineCode(line: string): string {
  const runs = [...line.matchAll(/`+/g)].map((run) => ({
    start: run.index,
    end: run.index + run[0].length,
  }));
  const nextSame = new Array<number>(runs.length).fill(-1);
  const seen = new Map<number, number>();
  for (let i = runs.length - 1; i >= 0; i--) {
    const length = runs[i].end - runs[i].start;
    nextSame[i] = seen.get(length) ?? -1;
    seen.set(length, i);
  }
  let result = "";
  let from = 0;
  for (let i = 0; i < runs.length; i++) {
    const j = nextSame[i];
    if (j === -1) continue;
    result += `${line.slice(from, runs[i].start)} `;
    from = runs[j].end;
    i = j;
  }
  return result + line.slice(from);
}

// What the markdown renders as code or a link; the render plugin skips the same nodes.
function plainText(body: string): string {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    if (fence) {
      const closing = CLOSING.exec(line);
      if (
        closing &&
        closing[1][0] === fence[0] &&
        closing[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    const opening = FENCE.exec(line);
    if (opening) {
      fence = opening[1];
      continue;
    }
    if (INDENTED.test(line)) continue;
    lines.push(withoutInlineCode(line));
  }
  return LINKS.reduce(
    (text, pattern) => text.replace(pattern, " "),
    lines.join("\n"),
  );
}

// The first MAX_MENTIONS different nicknames (case-insensitive, D37), as written.
export function extractMentions(body: string): string[] {
  if (!body.includes("@")) return [];
  const text = plainText(body);
  const found = new Map<string, string>();
  for (const [, nickname] of text.matchAll(MENTION)) {
    const key = nickname.toLowerCase();
    if (!found.has(key)) found.set(key, nickname);
    if (found.size === MAX_MENTIONS) break;
  }
  return [...found.values()];
}
