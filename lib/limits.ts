import type { ValidationError } from "@/lib/action-result";

// D72. Lengths are in UTF-16 code units of the stored string (String.length), the same in the
// browser and in the action. The content limit stays well below the ~1 MB at which React's
// Flight decoder rejects a Server Action argument (F8, task 62).
export const MAX_NAME_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 500_000;
export const MAX_NOTES_LENGTH = 100_000;
// Plain text shown to readers (task 98).
export const MAX_FOLDER_DESCRIPTION_LENGTH = 1000;

export const MAX_FOLDERS = 1000;
export const MAX_CHAPTERS_PER_FOLDER = 500;
export const MAX_VERSIONS_PER_FOLDER = 100;

// Social content (D80).
export const MAX_COMMENT_LENGTH = 5000;
export const MAX_POST_LENGTH = 20_000;
export const MAX_DM_LENGTH = 5000;
export const MAX_THREAD_TITLE_LENGTH = 200;
export const MAX_BIO_LENGTH = 1000;
export const MAX_BAN_REASON_LENGTH = 500;
export const MAX_REPORT_LENGTH = 1000;
// A reader's note on a passage, not the author's chapter notes (MAX_NOTES_LENGTH).
export const MAX_READER_NOTE_LENGTH = 2000;
export const MAX_QUOTE_LENGTH = 500;
export const MAX_SHELF_NAME_LENGTH = 50;
export const MAX_BOOKMARK_NAME_LENGTH = 100;
export const MAX_QUOTE_CONTEXT_LENGTH = 50;

export const MAX_MENTIONS = 10;
export const MAX_SHELVES = 20;
export const MAX_LIBRARY_ITEMS = 500;
export const MAX_MODERATORS = 10;
// Forum category names in each language (task 88).
export const MAX_CATEGORY_LABEL_LENGTH = 100;
// Bookmarks and reader notes together.
export const MAX_MARKS_PER_CHAPTER = 200;
export const MAX_MARKS_PER_ACCOUNT = 5000;

const LENGTHS = {
  folderName: { max: MAX_NAME_LENGTH, key: "folderNameTooLong" },
  title: { max: MAX_NAME_LENGTH, key: "titleTooLong" },
  content: { max: MAX_CONTENT_LENGTH, key: "contentTooLong" },
  notes: { max: MAX_NOTES_LENGTH, key: "notesTooLong" },
  folderNotes: { max: MAX_NOTES_LENGTH, key: "folderNotesTooLong" },
  folderDescription: {
    max: MAX_FOLDER_DESCRIPTION_LENGTH,
    key: "folderDescriptionTooLong",
  },
  comment: { max: MAX_COMMENT_LENGTH, key: "commentTooLong" },
  post: { max: MAX_POST_LENGTH, key: "postTooLong" },
  dm: { max: MAX_DM_LENGTH, key: "dmTooLong" },
  threadTitle: { max: MAX_THREAD_TITLE_LENGTH, key: "threadTitleTooLong" },
  bio: { max: MAX_BIO_LENGTH, key: "bioTooLong" },
  banReason: { max: MAX_BAN_REASON_LENGTH, key: "banReasonTooLong" },
  hideReason: { max: MAX_BAN_REASON_LENGTH, key: "hideReasonTooLong" },
  report: { max: MAX_REPORT_LENGTH, key: "reportTooLong" },
  readerNote: { max: MAX_READER_NOTE_LENGTH, key: "readerNoteTooLong" },
  quote: { max: MAX_QUOTE_LENGTH, key: "quoteTooLong" },
  shelfName: { max: MAX_SHELF_NAME_LENGTH, key: "shelfNameTooLong" },
  bookmarkName: { max: MAX_BOOKMARK_NAME_LENGTH, key: "bookmarkNameTooLong" },
  quoteContext: { max: MAX_QUOTE_CONTEXT_LENGTH, key: "quoteContextTooLong" },
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
  key:
    | "tooManyFolders"
    | "tooManyChapters"
    | "tooManyVersions"
    | "tooManyShelves"
    | "tooManyLibraryItems"
    | "tooManyChapterMarks"
    | "tooManyMarks"
    | "tooManyModerators",
): ValidationError {
  const max = {
    tooManyFolders: MAX_FOLDERS,
    tooManyChapters: MAX_CHAPTERS_PER_FOLDER,
    tooManyVersions: MAX_VERSIONS_PER_FOLDER,
    tooManyShelves: MAX_SHELVES,
    tooManyLibraryItems: MAX_LIBRARY_ITEMS,
    tooManyChapterMarks: MAX_MARKS_PER_CHAPTER,
    tooManyMarks: MAX_MARKS_PER_ACCOUNT,
    tooManyModerators: MAX_MODERATORS,
  }[key];
  return { ok: false, error: "INVALID_INPUT", key, values: { max } };
}
