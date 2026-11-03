import { useTranslations } from "next-intl";
import type { DocumentLabels } from "./english";

// Headings written into exported files and titles of untitled imported chapters.
export function useDocumentLabels(): DocumentLabels {
  const t = useTranslations("document");
  return {
    notes: t("notes"),
    folderNotes: t("folderNotes"),
    chapter: (number) => t("chapter", { number }),
  };
}
