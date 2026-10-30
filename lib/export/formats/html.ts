import type { ExportDocument } from "../document";
import { blocksToHtml, escapeXml } from "./xml";

const STYLE = `body{max-width:40em;margin:2em auto;padding:0 1em;font-family:Georgia,serif;line-height:1.6}
blockquote{margin-left:1em;padding-left:1em;border-left:3px solid #ccc}`;

export function buildHtml({ title, sections }: ExportDocument): string {
  const body = sections.map(
    (section) =>
      `<section>\n${section.title ? `<h2>${escapeXml(section.title)}</h2>\n` : ""}${blocksToHtml(section.blocks, section.title ? 2 : 1)}\n</section>`,
  );
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${escapeXml(title)}</h1>
${body.join("\n")}
</body>
</html>
`;
}
