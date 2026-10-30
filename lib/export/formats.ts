export const EXPORT_FORMATS = [
  {
    id: "docx",
    label: "Word (.docx)",
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    id: "odt",
    label: "OpenDocument (.odt)",
    extension: "odt",
    mime: "application/vnd.oasis.opendocument.text",
  },
  { id: "pdf", label: "PDF (.pdf)", extension: "pdf", mime: "application/pdf" },
  {
    id: "epub",
    label: "EPUB (.epub)",
    extension: "epub",
    mime: "application/epub+zip",
  },
  {
    id: "fb2",
    label: "FictionBook (.fb2)",
    extension: "fb2",
    mime: "application/x-fictionbook+xml",
  },
  {
    id: "html",
    label: "Web page (.html)",
    extension: "html",
    mime: "text/html;charset=utf-8",
  },
  {
    id: "txt",
    label: "Plain text (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
  },
  {
    id: "md",
    label: "Markdown, one file (.md)",
    extension: "md",
    mime: "text/markdown;charset=utf-8",
  },
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportFormatId = ExportFormat["id"];
