import { strFromU8 } from "fflate";
import { DomUtils } from "htmlparser2";
import { escapeXml } from "@/lib/export/formats/xml";
import { ImportError, structureMarkdown, type ImportedFile } from "../document";
import { unzip } from "../files";
import { htmlToMarkdown } from "../html";
import { nodesToHtml, parseXml, type XmlElement, type XmlNode } from "./xml";

type Styles = {
  bold: Set<string>;
  italic: Set<string>;
  quotes: Set<string>;
  numbered: Set<string>;
};

const SKIPPED = new Set([
  "office:annotation",
  "text:note",
  "text:tracked-changes",
  "draw:frame",
]);

function readStyles(nodes: XmlNode[]): Styles {
  const styles: Styles = {
    bold: new Set(),
    italic: new Set(),
    quotes: new Set(),
    numbered: new Set(),
  };
  for (const style of DomUtils.getElementsByTagName("style:style", nodes)) {
    const name = DomUtils.getAttributeValue(style, "style:name") ?? "";
    const [text] = DomUtils.getElementsByTagName(
      "style:text-properties",
      DomUtils.getChildren(style),
    );
    if (text && DomUtils.getAttributeValue(text, "fo:font-weight") === "bold")
      styles.bold.add(name);
    if (text && DomUtils.getAttributeValue(text, "fo:font-style") === "italic")
      styles.italic.add(name);
    const parent =
      DomUtils.getAttributeValue(style, "style:parent-style-name") ?? "";
    if (/^quot/i.test(name) || /^quot/i.test(parent)) styles.quotes.add(name);
  }
  for (const list of DomUtils.getElementsByTagName("text:list-style", nodes)) {
    const [level] = DomUtils.getElementsByTagName(
      () => true,
      DomUtils.getChildren(list),
    );
    if (level?.name === "text:list-level-style-number") {
      styles.numbered.add(DomUtils.getAttributeValue(list, "style:name") ?? "");
    }
  }
  return styles;
}

function converter(styles: Styles) {
  return (element: XmlElement, inner: string): string => {
    const styleName =
      DomUtils.getAttributeValue(element, "text:style-name") ?? "";
    switch (element.name) {
      case "text:h": {
        const level = Math.min(
          Number(
            DomUtils.getAttributeValue(element, "text:outline-level") ?? 1,
          ),
          6,
        );
        return `<h${level}>${inner}</h${level}>`;
      }
      case "text:p": {
        if (DomUtils.textContent(element).trim() === "* * *") return "<hr/>";
        if (styleName === "Title") return `<h1>${inner}</h1>`;
        return styles.quotes.has(styleName)
          ? `<blockquote><p>${inner}</p></blockquote>`
          : `<p>${inner}</p>`;
      }
      case "text:span": {
        let html = inner;
        if (styles.bold.has(styleName)) html = `<strong>${html}</strong>`;
        if (styles.italic.has(styleName)) html = `<em>${html}</em>`;
        return html;
      }
      case "text:a":
        return `<a href="${escapeXml(DomUtils.getAttributeValue(element, "xlink:href") ?? "")}">${inner}</a>`;
      case "text:line-break":
        return "<br/>";
      case "text:s":
        return " ".repeat(
          Number(DomUtils.getAttributeValue(element, "text:c") ?? 1),
        );
      case "text:tab":
        return "\t";
      case "text:list": {
        const tag = styles.numbered.has(styleName) ? "ol" : "ul";
        return `<${tag}>${inner}</${tag}>`;
      }
      case "text:list-item":
        return `<li>${inner}</li>`;
      default:
        return SKIPPED.has(element.name) ? "" : inner;
    }
  };
}

export function readOdt(
  bytes: Uint8Array,
  fallbackTitle: string,
): ImportedFile {
  const content = unzip(bytes)["content.xml"];
  if (!content)
    throw new ImportError("This OpenDocument file could not be read.");
  const nodes = parseXml(strFromU8(content)).children;
  const [text] = DomUtils.getElementsByTagName("office:text", nodes);
  if (!text) throw new ImportError("This OpenDocument file could not be read.");
  const html = nodesToHtml(
    DomUtils.getChildren(text),
    converter(readStyles(nodes)),
  );
  return structureMarkdown(htmlToMarkdown(html), fallbackTitle, {
    shifted: true,
  });
}
