import type { MarkdownManager } from "@tiptap/markdown";

// Same as @tiptap/markdown: blank lines a block token swallowed count as a separate space.
const TRAILING_BLANK_LINES = /\n[^\S\n]*(?:\n[^\S\n]*)+$/;

// Offset in `markdown` where each top-level node of manager.parse(markdown) starts, so a
// block shown in Preview can be found in Source and back. Mirrors how the manager turns
// top-level tokens into nodes, including the empty paragraphs extra blank lines become.
export function blockStarts(
  manager: MarkdownManager,
  markdown: string,
): number[] {
  const tokens = manager.instance
    .lexer(markdown)
    .flatMap((token, index, all): { type: string; raw: string }[] => {
      const blank = token.raw.match(TRAILING_BLANK_LINES);
      if (token.type === "space" || all[index + 1]?.type === "space" || !blank)
        return [token];
      return [
        { type: token.type, raw: token.raw.slice(0, -blank[0].length) },
        { type: "space", raw: blank[0] },
      ];
    });
  const starts: number[] = [];
  let offset = 0;
  tokens.forEach((token, index) => {
    let count: number;
    if (token.type === "space") {
      const separators = token.raw.match(/\n\n/g)?.length ?? 0;
      const edge = index === 0 || index === tokens.length - 1;
      count = Math.max(separators - (edge ? 0 : 1), 0);
    } else {
      count = manager.parse(token.raw).content?.length ?? 0;
    }
    for (let i = 0; i < count; i++) starts.push(offset);
    offset += token.raw.length;
  });
  return starts;
}
