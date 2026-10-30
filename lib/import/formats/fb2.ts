import { DomUtils } from "htmlparser2";
import { escapeXml } from "@/lib/export/formats/xml";
import {
  fromSections,
  ImportError,
  structureMarkdown,
  type ImportedFile,
} from "../document";
import { htmlToMarkdown } from "../html";
import {
  isElement,
  nodesToHtml,
  parseXml,
  type ElementToHtml,
  type XmlElement,
} from "./xml";

const TAGS: Record<string, string> = {
  p: "p",
  v: "p",
  emphasis: "em",
  strong: "strong",
  cite: "blockquote",
  epigraph: "blockquote",
  subtitle: "h2",
};

const toHtml: ElementToHtml = (element, inner) => {
  switch (element.name) {
    case "empty-line":
      return "<hr/>";
    case "a": {
      const href =
        DomUtils.getAttributeValue(element, "l:href") ??
        DomUtils.getAttributeValue(element, "xlink:href") ??
        "";
      return `<a href="${escapeXml(href)}">${inner}</a>`;
    }
    case "title":
      return `<h2>${DomUtils.textContent(element).trim()}</h2>`;
    default: {
      const tag = TAGS[element.name];
      return tag ? `<${tag}>${inner}</${tag}>` : inner;
    }
  }
};

function sectionToHtml(section: XmlElement): string {
  const nodes = DomUtils.getChildren(section);
  const heading = nodes.find(
    (node) => isElement(node) && node.name === "title",
  );
  const rest = nodes.filter((node) => node !== heading);
  const title = heading
    ? `<h1>${escapeXml(DomUtils.textContent(heading).trim())}</h1>`
    : "";
  return title + nodesToHtml(rest, toHtml);
}

export function readFb2(text: string, fallbackTitle: string): ImportedFile {
  const nodes = parseXml(text).children;
  const body = DomUtils.getElementsByTagName("body", nodes).find(
    (element) => DomUtils.getAttributeValue(element, "name") !== "notes",
  );
  if (!body) throw new ImportError("This FictionBook file could not be read.");
  const [bookTitle] = DomUtils.getElementsByTagName("book-title", nodes);
  const title =
    (bookTitle && DomUtils.textContent(bookTitle).trim()) || fallbackTitle;

  const children = DomUtils.getChildren(body).filter(isElement);
  const sectionElements = children.filter(({ name }) => name === "section");
  const parts = sectionElements.length ? sectionElements : [body];
  const sections = parts.flatMap((part) => {
    const markdown = htmlToMarkdown(sectionToHtml(part));
    if (!markdown.replace(/\*/g, "").trim()) return [];
    const { chapters, unsplit } = structureMarkdown(markdown, title, {
      shifted: true,
    });
    return [unsplit ?? chapters[0]];
  });
  // FB2 has no line break element, so exported single line breaks become paragraphs.
  return fromSections(title, sections, false);
}
