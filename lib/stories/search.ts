export function escapeRegex(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type Snippet = { before: string; match: string; after: string };

const PREVIEW_LENGTH = 200;
const CONTEXT_LENGTH = 80;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

// Without a match in the content (no query, or the hit is in the title), the snippet is the start of the content.
export function buildSnippet(content: string, query?: string): Snippet {
  const hit = query ? new RegExp(escapeRegex(query), "i").exec(content) : null;

  if (!hit) {
    const text = collapseWhitespace(content).trim();
    const cut = text.length > PREVIEW_LENGTH;
    return {
      before: cut ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text,
      match: "",
      after: "",
    };
  }

  const start = Math.max(0, hit.index - CONTEXT_LENGTH);
  const end = Math.min(
    content.length,
    hit.index + hit[0].length + CONTEXT_LENGTH,
  );
  const before = collapseWhitespace(
    content.slice(start, hit.index),
  ).trimStart();
  const after = collapseWhitespace(
    content.slice(hit.index + hit[0].length, end),
  ).trimEnd();

  return {
    before: start > 0 ? `…${before}` : before,
    match: hit[0],
    after: end < content.length ? `${after}…` : after,
  };
}
