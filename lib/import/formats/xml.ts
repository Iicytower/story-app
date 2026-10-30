import { DomUtils, parseDocument } from "htmlparser2";
import { escapeXml } from "@/lib/export/formats/xml";

export const parseXml = (xml: string) => parseDocument(xml, { xmlMode: true });

export type XmlNode = ReturnType<typeof parseXml>["children"][number];
export type XmlElement = Extract<XmlNode, { name: string; attribs: object }>;

export const isElement = (node: XmlNode): node is XmlElement =>
  node.type === "tag";

export type ElementToHtml = (element: XmlElement, inner: string) => string;

// Text is escaped here; each format decides what its elements become.
export function nodesToHtml(nodes: XmlNode[], convert: ElementToHtml): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeXml(node.data);
      if (!isElement(node)) return "";
      return convert(node, nodesToHtml(DomUtils.getChildren(node), convert));
    })
    .join("");
}
