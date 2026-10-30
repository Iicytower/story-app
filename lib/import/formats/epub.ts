import { strFromU8 } from "fflate";
import { DomUtils } from "htmlparser2";
import {
  fromSections,
  ImportError,
  structureMarkdown,
  type ImportedFile,
} from "../document";
import { decodeText, unzip } from "../files";
import { htmlToMarkdown } from "../html";
import { parseXml } from "./xml";

const INVALID = "This EPUB file could not be read.";

export function readEpub(
  bytes: Uint8Array,
  fallbackTitle: string,
): ImportedFile {
  const files = unzip(bytes);
  const container = files["META-INF/container.xml"];
  if (!container) throw new ImportError(INVALID);
  const [rootfile] = DomUtils.getElementsByTagName(
    "rootfile",
    parseXml(strFromU8(container)).children,
  );
  const opfPath = rootfile && DomUtils.getAttributeValue(rootfile, "full-path");
  if (!opfPath || !files[opfPath]) throw new ImportError(INVALID);
  const directory = opfPath.slice(0, opfPath.lastIndexOf("/") + 1);

  const opf = parseXml(decodeText(files[opfPath])).children;
  const [titleElement] = DomUtils.getElementsByTagName("dc:title", opf);
  const title =
    (titleElement && DomUtils.textContent(titleElement).trim()) ||
    fallbackTitle;
  const hrefs = new Map(
    DomUtils.getElementsByTagName("item", opf).map((item) => [
      DomUtils.getAttributeValue(item, "id"),
      DomUtils.getAttributeValue(item, "href"),
    ]),
  );

  const sections = DomUtils.getElementsByTagName("itemref", opf).flatMap(
    (itemref, index) => {
      const href = hrefs.get(DomUtils.getAttributeValue(itemref, "idref"));
      const file = href && files[directory + decodeURIComponent(href)];
      if (!file) return [];
      const nodes = parseXml(decodeText(file)).children;
      const body = DomUtils.findOne(
        (element) => element.name === "body",
        nodes,
      );
      if (!body) return [];
      const markdown = htmlToMarkdown(
        DomUtils.getInnerHTML(body, { xmlMode: true }),
      );
      if (!markdown.trim()) return [];
      const { chapters, unsplit } = structureMarkdown(
        markdown,
        `Chapter ${index + 1}`,
        { shifted: true },
      );
      return [unsplit ?? chapters[0]];
    },
  );
  return fromSections(title, sections, false);
}
