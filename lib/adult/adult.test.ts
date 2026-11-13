import { describe, expect, it } from "vitest";
import {
  chapterAdultState,
  folderAdultState,
  isAdult,
} from "./adult";

describe("isAdult", () => {
  it("is false for a missing or empty mark", () => {
    expect(isAdult(undefined)).toBe(false);
    expect(isAdult({})).toBe(false);
    expect(isAdult({ manual: false, auto: false })).toBe(false);
  });

  it("is true for a manual or automatic mark", () => {
    expect(isAdult({ manual: true })).toBe(true);
    expect(isAdult({ auto: true })).toBe(true);
  });
});

describe("folderAdultState", () => {
  it("is unlocked when marked by the owner", () => {
    expect(folderAdultState({ manual: true })).toEqual({
      adult: true,
      lock: null,
    });
  });

  it("is locked by an automatic mark, also with a manual one", () => {
    expect(folderAdultState({ auto: true })).toEqual({
      adult: true,
      lock: "auto",
    });
    expect(folderAdultState({ manual: true, auto: true }).lock).toBe("auto");
  });

  it("keeps the manual mark after the automatic source goes", () => {
    expect(folderAdultState({ manual: true, auto: false })).toEqual({
      adult: true,
      lock: null,
    });
    expect(folderAdultState({ auto: false }).adult).toBe(false);
  });
});

describe("chapterAdultState", () => {
  it("is not 18+ without any mark", () => {
    expect(chapterAdultState(undefined, undefined)).toEqual({
      adult: false,
      lock: null,
    });
  });

  it("uses the chapter's own manual mark", () => {
    expect(chapterAdultState({ manual: true }, {})).toEqual({
      adult: true,
      lock: null,
    });
  });

  it("inherits an 18+ folder, locked by the folder", () => {
    expect(chapterAdultState({}, { manual: true })).toEqual({
      adult: true,
      lock: "folder",
    });
    expect(chapterAdultState(undefined, { auto: true })).toEqual({
      adult: true,
      lock: "folder",
    });
  });

  it("prefers its own automatic lock over the folder", () => {
    expect(chapterAdultState({ auto: true }, { manual: true }).lock).toBe(
      "auto",
    );
  });

  it("does not mark the folder", () => {
    expect(folderAdultState(undefined).adult).toBe(false);
  });
});

describe("the admin's mark (task 88)", () => {
  it("decides over the manual and automatic marks", () => {
    expect(isAdult({ admin: true })).toBe(true);
    expect(isAdult({ admin: false, manual: true, auto: true })).toBe(false);
  });

  it("locks the mark with true, before the automatic lock", () => {
    expect(folderAdultState({ admin: true })).toEqual({
      adult: true,
      lock: "admin",
    });
    expect(folderAdultState({ admin: true, auto: true }).lock).toBe("admin");
    expect(chapterAdultState({ admin: true }, { manual: true }).lock).toBe(
      "admin",
    );
  });

  it("lifts the mark and the image lock with false", () => {
    expect(folderAdultState({ admin: false, auto: true })).toEqual({
      adult: false,
      lock: null,
    });
    expect(chapterAdultState({ admin: false, auto: true }, {})).toEqual({
      adult: false,
      lock: null,
    });
  });

  it("does not lift an 18+ folder from a chapter", () => {
    expect(chapterAdultState({ admin: false }, { manual: true })).toEqual({
      adult: true,
      lock: "folder",
    });
  });
});
