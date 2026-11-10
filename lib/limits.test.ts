import { describe, expect, it } from "vitest";
import {
  countError,
  lengthError,
  MAX_BAN_REASON_LENGTH,
  MAX_BIO_LENGTH,
  MAX_BOOKMARK_NAME_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_DM_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_POST_LENGTH,
  MAX_QUOTE_CONTEXT_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_READER_NOTE_LENGTH,
  MAX_REPORT_LENGTH,
  MAX_SHELF_NAME_LENGTH,
  MAX_THREAD_TITLE_LENGTH,
} from "./limits";

describe("lengthError", () => {
  it.each([
    ["folderName", MAX_NAME_LENGTH, "folderNameTooLong"],
    ["title", MAX_NAME_LENGTH, "titleTooLong"],
    ["content", MAX_CONTENT_LENGTH, "contentTooLong"],
    ["notes", MAX_NOTES_LENGTH, "notesTooLong"],
    ["folderNotes", MAX_NOTES_LENGTH, "folderNotesTooLong"],
    ["comment", MAX_COMMENT_LENGTH, "commentTooLong"],
    ["post", MAX_POST_LENGTH, "postTooLong"],
    ["dm", MAX_DM_LENGTH, "dmTooLong"],
    ["threadTitle", MAX_THREAD_TITLE_LENGTH, "threadTitleTooLong"],
    ["bio", MAX_BIO_LENGTH, "bioTooLong"],
    ["banReason", MAX_BAN_REASON_LENGTH, "banReasonTooLong"],
    ["report", MAX_REPORT_LENGTH, "reportTooLong"],
    ["readerNote", MAX_READER_NOTE_LENGTH, "readerNoteTooLong"],
    ["quote", MAX_QUOTE_LENGTH, "quoteTooLong"],
    ["shelfName", MAX_SHELF_NAME_LENGTH, "shelfNameTooLong"],
    ["bookmarkName", MAX_BOOKMARK_NAME_LENGTH, "bookmarkNameTooLong"],
    ["quoteContext", MAX_QUOTE_CONTEXT_LENGTH, "quoteContextTooLong"],
  ] as const)("%s: up to %i characters", (field, max, key) => {
    expect(lengthError(field, "a".repeat(max))).toBeNull();
    expect(lengthError(field, "a".repeat(max + 1))).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      key,
      values: { max },
    });
  });

  it("sets the social limits from D80", () => {
    expect([
      MAX_COMMENT_LENGTH,
      MAX_POST_LENGTH,
      MAX_DM_LENGTH,
      MAX_THREAD_TITLE_LENGTH,
      MAX_BIO_LENGTH,
      MAX_BAN_REASON_LENGTH,
      MAX_REPORT_LENGTH,
      MAX_READER_NOTE_LENGTH,
      MAX_QUOTE_LENGTH,
      MAX_SHELF_NAME_LENGTH,
      MAX_BOOKMARK_NAME_LENGTH,
      MAX_QUOTE_CONTEXT_LENGTH,
    ]).toEqual([
      5000, 20_000, 5000, 200, 1000, 500, 1000, 2000, 500, 50, 100, 50,
    ]);
  });

  it("counts characters, not bytes", () => {
    expect(lengthError("title", "ż".repeat(MAX_NAME_LENGTH))).toBeNull();
  });
});

describe("countError", () => {
  it("names the limit", () => {
    expect(countError("tooManyVersions")).toMatchObject({
      error: "INVALID_INPUT",
      key: "tooManyVersions",
      values: { max: 100 },
    });
    expect(countError("tooManyFolders").values).toEqual({ max: 1000 });
    expect(countError("tooManyChapters").values).toEqual({ max: 500 });
    expect(countError("tooManyShelves").values).toEqual({ max: 20 });
    expect(countError("tooManyLibraryItems").values).toEqual({ max: 500 });
  });
});
