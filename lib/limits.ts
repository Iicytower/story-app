import type { ValidationError } from "@/lib/action-result";

// D72. Lengths are in UTF-16 code units of the stored string (String.length), the same in the
// browser and in the action. The content limit stays well below the ~1 MB at which React's
// Flight decoder rejects a Server Action argument (F8, task 62).
export const MAX_NAME_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 500_000;
export const MAX_NOTES_LENGTH = 100_000;

export const MAX_FOLDERS = 1000;
export const MAX_CHAPTERS_PER_FOLDER = 500;
export const MAX_VERSIONS_PER_FOLDER = 100;

const LENGTHS = {
  folderName: { max: MAX_NAME_LENGTH, key: "folderNameTooLong" },
  title: { max: MAX_NAME_LENGTH, key: "titleTooLong" },
  content: { max: MAX_CONTENT_LENGTH, key: "contentTooLong" },
  notes: { max: MAX_NOTES_LENGTH, key: "notesTooLong" },
  folderNotes: { max: MAX_NOTES_LENGTH, key: "folderNotesTooLong" },
} as const;

export type LimitedField = keyof typeof LENGTHS;

export function lengthError(
  field: LimitedField,
  value: string,
): ValidationError | null {
  const { max, key } = LENGTHS[field];
  if (value.length <= max) return null;
  return { ok: false, error: "INVALID_INPUT", key, values: { max } };
}

export function countError(
  key: "tooManyFolders" | "tooManyChapters" | "tooManyVersions",
): ValidationError {
  const max = {
    tooManyFolders: MAX_FOLDERS,
    tooManyChapters: MAX_CHAPTERS_PER_FOLDER,
    tooManyVersions: MAX_VERSIONS_PER_FOLDER,
  }[key];
  return { ok: false, error: "INVALID_INPUT", key, values: { max } };
}
