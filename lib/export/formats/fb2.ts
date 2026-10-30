import { splitLines, type Block, type Span } from "../blocks";
import type { ExportDocument } from "../document";
import { escapeXml } from "./xml";

function spanToFb2(span: Span): string {
  let xml = escapeXml(span.text);
  if (span.bold) xml = `<strong>${xml}</strong>`;
  if (span.italic) xml = `<emphasis>${xml}</emphasis>`;
  if (span.href) xml = `<a l:href="${escapeXml(span.href)}">${xml}</a>`;
  return xml;
}

// FB2 has no line break element, so each line becomes its own paragraph.
function paragraphs(spans: Span[], tag = "p", prefix = ""): string {
  return splitLines(spans)
    .map(
      (line) =>
        `<${tag}>${escapeXml(prefix)}${line.map(spanToFb2).join("")}</${tag}>`,
    )
    .join("\n");
}

function blocksToFb2(blocks: Block[], prefix = ""): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return paragraphs(block.spans, "p", prefix);
        case "heading":
          return paragraphs(block.spans, "subtitle");
        case "quote":
          return `<cite>\n${blocksToFb2(block.blocks)}\n</cite>`;
        case "list":
          return block.items
            .map((item, index) =>
              blocksToFb2(item, block.ordered ? `${index + 1}. ` : "– "),
            )
            .join("\n");
        case "rule":
          return "<empty-line/>";
      }
    })
    .join("\n");
}

export function buildFb2(
  { title, sections }: ExportDocument,
  now = new Date(),
): string {
  const name = escapeXml(title);
  const date = now.toISOString().slice(0, 10);
  const body = sections.map((section) => {
    const heading = section.title
      ? `<title><p>${escapeXml(section.title)}</p></title>\n`
      : "";
    return `<section>\n${heading}${blocksToFb2(section.blocks) || "<empty-line/>"}\n</section>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description>
<title-info>
<genre>prose</genre>
<author><nickname>Unknown</nickname></author>
<book-title>${name}</book-title>
<lang>pl</lang>
</title-info>
<document-info>
<author><nickname>Unknown</nickname></author>
<date value="${date}">${date}</date>
<id>${crypto.randomUUID()}</id>
<version>1.0</version>
</document-info>
</description>
<body>
<title><p>${name}</p></title>
${body.join("\n")}
</body>
</FictionBook>
`;
}
