import { marked, type Token, type Tokens } from "marked";

export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
  // A forced line break after the text (single Enter in the source, D20).
  lineBreak?: boolean;
};

export type Block =
  | { type: "paragraph"; spans: Span[] }
  | { type: "heading"; level: 1 | 2 | 3; spans: Span[] }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; items: Block[][] }
  | { type: "rule" };

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

function allowedHref(url: string): string | undefined {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(url).protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

const COMMENT = /^\s*<!--([\s\S]*?)-->\s*$/;

// Only comments the caller kept reach this point; they read as bracketed italics.
function commentSpans(html: string): Span[] {
  const comment = COMMENT.exec(html);
  if (!comment) return [];
  const lines = `[${comment[1].trim()}]`.split("\n");
  return lines.map((text, index) => ({
    text,
    italic: true,
    lineBreak: index < lines.length - 1,
  }));
}

function toSpans(tokens: Token[], style: Partial<Span> = {}): Span[] {
  return tokens.flatMap((token): Span[] => {
    switch (token.type) {
      case "strong":
      case "em": {
        const { tokens: inner = [] } = token as Tokens.Strong;
        const key = token.type === "strong" ? "bold" : "italic";
        return toSpans(inner, { ...style, [key]: true });
      }
      case "link": {
        const { tokens: inner = [], href } = token as Tokens.Link;
        return toSpans(inner, { ...style, href: allowedHref(href) });
      }
      case "br":
        return [{ text: "", ...style, lineBreak: true }];
      case "text":
      case "escape": {
        const { tokens: inner, text } = token as Tokens.Text;
        return inner ? toSpans(inner, style) : [{ text, ...style }];
      }
      // Other raw HTML is not rendered anywhere in the app (D8, D20).
      case "html":
        return commentSpans((token as Tokens.HTML).text);
      default:
        return "text" in token ? [{ text: String(token.text), ...style }] : [];
    }
  });
}

function toBlocks(tokens: Token[]): Block[] {
  return tokens.flatMap((token): Block[] => {
    switch (token.type) {
      case "paragraph":
        return [
          {
            type: "paragraph",
            spans: toSpans((token as Tokens.Paragraph).tokens ?? []),
          },
        ];
      case "heading": {
        const { depth, tokens: inner = [] } = token as Tokens.Heading;
        const level = Math.min(depth, 3) as 1 | 2 | 3;
        return [{ type: "heading", level, spans: toSpans(inner) }];
      }
      case "blockquote":
        return [
          {
            type: "quote",
            blocks: toBlocks((token as Tokens.Blockquote).tokens ?? []),
          },
        ];
      case "list": {
        const { ordered, items } = token as Tokens.List;
        return [
          {
            type: "list",
            ordered,
            items: items.map((item) => toBlocks(item.tokens)),
          },
        ];
      }
      case "hr":
        return [{ type: "rule" }];
      case "html": {
        const spans = commentSpans((token as Tokens.HTML).text);
        return spans.length ? [{ type: "paragraph", spans }] : [];
      }
      case "text": {
        const { tokens: inner, text } = token as Tokens.Text;
        return [
          { type: "paragraph", spans: inner ? toSpans(inner) : [{ text }] },
        ];
      }
      default:
        return [];
    }
  });
}

export function parseBlocks(markdown: string): Block[] {
  return toBlocks(marked.lexer(markdown, { breaks: true, gfm: true }));
}

export function spansText(spans: Span[]): string {
  return spans.map((span) => span.text + (span.lineBreak ? "\n" : "")).join("");
}

export function splitLines(spans: Span[]): Span[][] {
  const lines: Span[][] = [[]];
  for (const span of spans) {
    lines[lines.length - 1].push(span);
    if (span.lineBreak) lines.push([]);
  }
  return lines.filter((line) => line.some((span) => span.text));
}
