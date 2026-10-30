import { strToU8, zipSync } from "fflate";
import type { Block, Span } from "../blocks";
import type { ExportDocument } from "../document";
import { escapeXml } from "./xml";

const NAMESPACES = `xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"`;

const AUTOMATIC_STYLES = `<office:automatic-styles>
<style:style style:name="B" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="I" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
<style:style style:name="BI" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic"/></style:style>
<style:style style:name="Rule" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
<style:style style:name="Quote" style:family="paragraph"><style:paragraph-properties fo:margin-left="1cm"/></style:style>
<text:list-style style:name="Bullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.5cm" text:min-label-width="0.5cm"/></text:list-level-style-bullet></text:list-style>
<text:list-style style:name="Numbers"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."><style:list-level-properties text:space-before="0.5cm" text:min-label-width="0.5cm"/></text:list-level-style-number></text:list-style>
</office:automatic-styles>`;

// ODF collapses repeated spaces unless they are written as <text:s/>.
const odfText = (text: string) =>
  escapeXml(text)
    .replace(/ {2,}/g, (run) => ` <text:s text:c="${run.length - 1}"/>`)
    .replace(/\t/g, "<text:tab/>");

function spanToOdf(span: Span): string {
  let xml = odfText(span.text);
  const style = `${span.bold ? "B" : ""}${span.italic ? "I" : ""}`;
  if (style) xml = `<text:span text:style-name="${style}">${xml}</text:span>`;
  if (span.href) {
    xml = `<text:a xlink:type="simple" xlink:href="${escapeXml(span.href)}">${xml}</text:a>`;
  }
  return span.lineBreak ? `${xml}<text:line-break/>` : xml;
}

const inline = (spans: Span[]) => spans.map(spanToOdf).join("");

function blocksToOdf(
  blocks: Block[],
  headingOffset: number,
  paragraphStyle = "Standard",
): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<text:p text:style-name="${paragraphStyle}">${inline(block.spans)}</text:p>`;
        case "heading":
          return `<text:h text:outline-level="${block.level + headingOffset}">${inline(block.spans)}</text:h>`;
        case "quote":
          return blocksToOdf(block.blocks, headingOffset, "Quote");
        case "list": {
          const style = block.ordered ? "Numbers" : "Bullets";
          const items = block.items.map(
            (item) =>
              `<text:list-item>${blocksToOdf(item, headingOffset)}</text:list-item>`,
          );
          return `<text:list text:style-name="${style}">${items.join("")}</text:list>`;
        }
        case "rule":
          return `<text:p text:style-name="Rule">* * *</text:p>`;
      }
    })
    .join("\n");
}

export function buildOdt({ title, sections }: ExportDocument): Uint8Array {
  const body = sections.map((section) => {
    const heading = section.title
      ? `<text:h text:outline-level="2">${odfText(section.title)}</text:h>\n`
      : "";
    return heading + blocksToOdf(section.blocks, section.title ? 2 : 1);
  });
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NAMESPACES}>
${AUTOMATIC_STYLES}
<office:body><office:text>
<text:h text:outline-level="1">${odfText(title)}</text:h>
${body.join("\n")}
</office:text></office:body>
</office:document-content>
`;
  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NAMESPACES}>
<office:meta><dc:title>${escapeXml(title)}</dc:title></office:meta>
</office:document-meta>
`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
`;
  return zipSync({
    // ODF requires "mimetype" as the first entry, uncompressed.
    mimetype: [
      strToU8("application/vnd.oasis.opendocument.text"),
      { level: 0 },
    ],
    "content.xml": strToU8(content),
    "meta.xml": strToU8(meta),
    "META-INF/manifest.xml": strToU8(manifest),
  });
}
