import { describe, expect, it } from "vitest";
import {
  countError,
  lengthError,
  MAX_CONTENT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
} from "./limits";

describe("lengthError", () => {
  it.each([
    ["folderName", MAX_NAME_LENGTH, "folderNameTooLong"],
    ["title", MAX_NAME_LENGTH, "titleTooLong"],
    ["content", MAX_CONTENT_LENGTH, "contentTooLong"],
    ["notes", MAX_NOTES_LENGTH, "notesTooLong"],
    ["folderNotes", MAX_NOTES_LENGTH, "folderNotesTooLong"],
  ] as const)("%s: up to %i characters", (field, max, key) => {
    expect(lengthError(field, "a".repeat(max))).toBeNull();
    expect(lengthError(field, "a".repeat(max + 1))).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      key,
      values: { max },
    });
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
  });
});
