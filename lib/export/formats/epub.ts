import { strToU8, zipSync, type Zippable } from "fflate";
import type { ExportDocument } from "../document";
import { blocksToHtml, escapeXml } from "./xml";

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;

const xhtml = (title: string, body: string, attrs = "") =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pl" lang="pl"${attrs}>
<head><title>${escapeXml(title)}</title></head>
<body>
${body}
</body>
</html>
`;

export function buildEpub(
  { title, sections }: ExportDocument,
  now = new Date(),
): Uint8Array {
  const chapters = sections.map((section, index) => ({
    file: `chapter-${index + 1}.xhtml`,
    title: section.title ?? title,
    body: `<h1>${escapeXml(section.title ?? title)}</h1>\n${blocksToHtml(section.blocks, 1)}`,
  }));
  const modified = `${now.toISOString().slice(0, 19)}Z`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:uuid:${crypto.randomUUID()}</dc:identifier>
<dc:title>${escapeXml(title)}</dc:title>
<dc:language>pl</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${chapters.map((chapter, index) => `<item id="c${index + 1}" href="${chapter.file}" media-type="application/xhtml+xml"/>`).join("\n")}
</manifest>
<spine>
${chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join("\n")}
</spine>
</package>
`;
  const nav = xhtml(
    title,
    `<nav epub:type="toc"><h1>Contents</h1><ol>
${chapters.map((chapter) => `<li><a href="${chapter.file}">${escapeXml(chapter.title)}</a></li>`).join("\n")}
</ol></nav>`,
  );

  const files: Zippable = {
    // Readers detect the format from a first, uncompressed "mimetype" entry.
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(CONTAINER),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
  };
  for (const chapter of chapters) {
    files[`OEBPS/${chapter.file}`] = strToU8(
      xhtml(chapter.title, chapter.body),
    );
  }
  return zipSync(files);
}
