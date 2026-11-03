export const EXPORT_FORMATS = [
  {
    id: "docx",
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    id: "odt",
    extension: "odt",
    mime: "application/vnd.oasis.opendocument.text",
  },
  { id: "pdf", extension: "pdf", mime: "application/pdf" },
  {
    id: "epub",
    extension: "epub",
    mime: "application/epub+zip",
  },
  {
    id: "fb2",
    extension: "fb2",
    mime: "application/x-fictionbook+xml",
  },
  {
    id: "html",
    extension: "html",
    mime: "text/html;charset=utf-8",
  },
  {
    id: "txt",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
  },
  {
    id: "md",
    extension: "md",
    mime: "text/markdown;charset=utf-8",
  },
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportFormatId = ExportFormat["id"];
