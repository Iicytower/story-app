import type { Block, Span } from "../blocks";

// Control characters are forbidden in XML 1.0, even as character references.
export function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spanToHtml(span: Span): string {
  let html = escapeXml(span.text);
  if (span.bold) html = `<strong>${html}</strong>`;
  if (span.italic) html = `<em>${html}</em>`;
  if (span.href) html = `<a href="${escapeXml(span.href)}">${html}</a>`;
  return span.lineBreak ? `${html}<br/>` : html;
}

// Also valid XHTML, so EPUB shares it with the .html export.
export function blocksToHtml(blocks: Block[], headingOffset: number): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<p>${block.spans.map(spanToHtml).join("")}</p>`;
        case "heading": {
          const tag = `h${Math.min(block.level + headingOffset, 6)}`;
          return `<${tag}>${block.spans.map(spanToHtml).join("")}</${tag}>`;
        }
        case "quote":
          return `<blockquote>${blocksToHtml(block.blocks, headingOffset)}</blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map(
            (item) => `<li>${blocksToHtml(item, headingOffset)}</li>`,
          );
          return `<${tag}>${items.join("")}</${tag}>`;
        }
        case "rule":
          return "<hr/>";
      }
    })
    .join("\n");
}
