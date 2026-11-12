import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolderVersion,
  deleteFolderVersion,
  restoreEntireVersion,
  restoreFolderVersion,
} from "@/app/[locale]/(protected)/books/[id]/versions/actions";
import {
  setCoverAdult,
  setFolderCover,
} from "@/app/[locale]/(protected)/books/[id]/cover-actions";
import {
  createFolder,
  deleteFolder,
  moveFolder,
  publishAllChapters,
  renameFolder,
  saveFolderNotes,
  setChapterSort,
  setFolderAdult,
  setFolderLanguage,
  setFolderPublished,
  setFolderSort,
  setFolderTags,
} from "@/app/[locale]/(protected)/books/actions";
import {
  createStory,
  deleteStory,
  importStories,
  moveChapter,
  moveStory,
  saveStory,
  setChapterPublished,
  setStoryAdult,
  setStoryTags,
} from "@/app/[locale]/(protected)/chapters/actions";
import { login } from "@/app/[locale]/auth/login-actions";
import { requireUser } from "@/lib/auth/session";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const OLD = new Date("2026-01-01T00:00:00.000Z");
// Arguments a request body can carry in place of the declared type (F7).
const WRONG: unknown[] = [123, [], {}, null, { $ne: 0 }, true];
const WRONG_DATE: unknown[] = [...WRONG, "not a date", "2026-01-01"];
const WRONG_BOOLEAN: unknown[] = [123, [], {}, null, "true", { $ne: 0 }];

let folderId: string;
let storyId: string;

beforeEach(async () => {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice.toString(),
  });
  vi.stubEnv("TOOLS_API_URL", "http://127.0.0.1:1");
  vi.stubEnv("TOOLS_API_SECRET", "secret");
  const folder = await Folder.create({
    userId: alice,
    name: "Book",
    notes: "folder notes",
    lastActivityAt: OLD,
    notesUpdatedAt: OLD,
  });
  folderId = folder._id.toString();
  const story = await Story.create({
    userId: alice,
    folderId: folder._id,
    title: "Chapter",
    content: "content",
    notes: "notes",
  });
  storyId = story._id.toString();
});

// Any value: the actions are called the way a forged request would call them.
type Loose = (...args: unknown[]) => Promise<unknown>;
const loose = (action: unknown) => action as Loose;

async function snapshot() {
  const folders = await Folder.find().lean();
  const stories = await Story.find().lean();
  return JSON.stringify({ folders, stories });
}

async function expectRejected(
  action: unknown,
  args: unknown[],
  error = "INVALID_INPUT",
) {
  const before = await snapshot();
  const result = await loose(action)(...args);
  expect(result, JSON.stringify(args)).toMatchObject({ ok: false, error });
  expect(await snapshot()).toBe(before);
}

describe("Server Actions reject arguments of the wrong type", () => {
  it("text arguments", async () => {
    for (const value of WRONG) {
      await expectRejected(createFolder, [value]);
      await expectRejected(renameFolder, [folderId, value]);
      await expectRejected(createStory, [value, "Book"]);
      await expectRejected(createStory, ["Title", value]);
      await expectRejected(createFolderVersion, [folderId, value]);
      await expectRejected(setFolderSort, [value]);
      await expectRejected(setChapterSort, [folderId, value]);
      await expectRejected(setFolderLanguage, [folderId, value]);
      await expectRejected(importStories, [
        { kind: "folder", id: folderId },
        value,
        "",
      ]);
      await expectRejected(importStories, [
        { kind: "folder", id: folderId },
        [{ title: "T", content: value, notes: "" }],
        "",
      ]);
    }
  });

  it("tag arguments", async () => {
    for (const value of [123, "tag", {}, null, [1], [{}], true]) {
      await expectRejected(setFolderTags, [folderId, value]);
      await expectRejected(setStoryTags, [storyId, value]);
    }
  });

  it("index arguments", async () => {
    for (const value of ["1", [], {}, null, -1, 1.5, true]) {
      await expectRejected(moveFolder, [folderId, value]);
      await expectRejected(moveChapter, [storyId, value]);
    }
  });

  it("saveStory: title, content, notes and expectedUpdatedAt", async () => {
    const at = (await Story.findById(storyId).lean())!.updatedAt.toISOString();
    for (const value of WRONG) {
      await expectRejected(saveStory, [storyId, value, "c", "n", at]);
      await expectRejected(saveStory, [storyId, "T", value, "n", at]);
      await expectRejected(saveStory, [storyId, "T", "c", value, at]);
    }
    for (const value of WRONG_DATE) {
      await expectRejected(saveStory, [storyId, "T", "c", "n", value]);
    }
  });

  it("saveFolderNotes: notes and expectedNotesUpdatedAt", async () => {
    for (const value of WRONG) {
      await expectRejected(saveFolderNotes, [
        folderId,
        value,
        OLD.toISOString(),
      ]);
    }
    for (const value of WRONG_DATE) {
      await expectRejected(saveFolderNotes, [folderId, "notes", value]);
    }
  });

  it("boolean arguments", async () => {
    for (const value of WRONG_BOOLEAN) {
      await expectRejected(setChapterPublished, [storyId, value]);
      await expectRejected(setFolderPublished, [folderId, value]);
      await expectRejected(setStoryAdult, [storyId, value]);
      await expectRejected(setFolderAdult, [folderId, value]);
      await expectRejected(setCoverAdult, [folderId, value]);
    }
  });

  it("form data arguments", async () => {
    for (const value of WRONG) {
      await expectRejected(setFolderCover, [folderId, value]);
      expect(await login(null, value as FormData)).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
      });
    }
  });

  // An ID of the wrong type is an ID that does not exist (D1).
  it("ID arguments give NOT_FOUND", async () => {
    for (const value of [...WRONG, { _bsontype: "ObjectId" }]) {
      for (const [action, args] of [
        [renameFolder, [value, "Name"]],
        [deleteFolder, [value]],
        [saveFolderNotes, [value, "n", OLD.toISOString()]],
        [setFolderPublished, [value, true]],
        [publishAllChapters, [value]],
        [setFolderAdult, [value, true]],
        [deleteStory, [value]],
        [moveStory, [value, folderId]],
        [moveStory, [storyId, value]],
        [saveStory, [value, "T", "c", "n", OLD.toISOString()]],
        [setChapterPublished, [value, true]],
        [setStoryAdult, [value, true]],
        [createFolderVersion, [value, "v"]],
        [restoreEntireVersion, [value, 1]],
        [restoreEntireVersion, [folderId, value]],
        [restoreFolderVersion, [folderId, value, [], []]],
        [deleteFolderVersion, [folderId, value]],
        [importStories, [{ kind: "folder", id: value }, [], ""]],
      ] as const) {
        const before = await snapshot();
        const result = await loose(action)(...args);
        expect(result, JSON.stringify(args)).toMatchObject({
          ok: false,
          error: expect.stringMatching(/^(NOT_FOUND|INVALID_INPUT)$/),
        });
        expect(await snapshot()).toBe(before);
      }
    }
  });
});
