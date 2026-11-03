import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import type { ErrorMessage } from "./messages";

const errors = createTranslator({
  locale: "en",
  messages: en,
  namespace: "errors",
});
const documentLabel = createTranslator({
  locale: "en",
  messages: en,
  namespace: "document",
});

// For text outside a request: the create-account script and thrown errors.
export function inEnglish({ key, values }: ErrorMessage): string {
  return errors(key, values);
}

// Headings of every language, so a file exported in one imports in another.
const DOCUMENTS = [en.document, pl.document];
export const NOTES_HEADINGS = DOCUMENTS.map((labels) => labels.notes);
export const FOLDER_NOTES_HEADINGS = DOCUMENTS.map(
  (labels) => labels.folderNotes,
);

export type DocumentLabels = {
  notes: string;
  folderNotes: string;
  chapter: (number: number) => string;
};

// Default for code without a request or page: tests and the server-side zip export.
export const ENGLISH_DOCUMENT_LABELS: DocumentLabels = {
  notes: documentLabel("notes"),
  folderNotes: documentLabel("folderNotes"),
  chapter: (number) => documentLabel("chapter", { number }),
};
