import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importStories } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import {
  MAX_IMPORT_CHAPTERS,
  MAX_IMPORT_TEXT_BYTES,
  MAX_IMPORT_TITLE_LENGTH,
} from "@/lib/import/limits";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

const unauthorized: ActionError = {
  ok: false,
  error: "UNAUTHORIZED",
  message: "Your session has expired. Please sign in again.",
};

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId ? { ok: true, userId: userId.toString() } : unauthorized,
  );
}

beforeEach(() => signInAs(alice));

const chapter = (title: string, content = "Tekst", notes = "") => ({
  title,
  content,
  notes,
});

const seedFolder = (userId: Types.ObjectId, name: string, notes = "") =>
  Folder.create({ userId, name, notes, position: 0 });

describe("importStories", () => {
  it("requires a session", async () => {
    signInAs(null);
    const result = await importStories(
      { kind: "new", name: "F" },
      [chapter("A")],
      "",
    );
    expect(result).toEqual(unauthorized);
    expect(await Folder.countDocuments()).toBe(0);
  });

  it("creates a new folder that keeps the file's order", async () => {
    const result = await importStories(
      { kind: "new", name: " Książka " },
      [chapter("B", "Treść", "Notatka"), chapter("A")],
      "Notatki folderu",
    );
    expect(result.ok).toBe(true);
    const folder = await Folder.findOne({ name: "Książka" }).lean();
    expect(folder).toMatchObject({
      userId: alice,
      notes: "Notatki folderu",
      chapterSort: "manual",
      manualChapterOrder: true,
    });
    const stories = await Story.find({ folderId: folder?._id })
      .sort({ position: 1 })
      .lean();
    expect(stories).toMatchObject([
      { title: "B", content: "Treść", notes: "Notatka", position: 0 },
      { title: "A", position: 1 },
    ]);
    expect(stories[0].userId).toEqual(alice);
    expect(result.ok && result.storyId).toBe(stories[0]._id.toString());
  });

  it("numbers a taken folder name, even another chapter's duplicate", async () => {
    await seedFolder(alice, "F");
    await seedFolder(alice, "F (2)");
    await importStories({ kind: "new", name: "F" }, [chapter("A")], "");
    expect(await Folder.exists({ name: "F (3)", userId: alice })).toBeTruthy();
  });

  it("numbers titles taken in the folder and within the file", async () => {
    const folder = await seedFolder(alice, "F");
    await Story.create({
      userId: alice,
      folderId: folder._id,
      title: "A",
      position: 4,
    });
    const result = await importStories(
      { kind: "folder", id: folder._id.toString() },
      [chapter("A"), chapter(" A ")],
      "",
    );
    expect(result.ok).toBe(true);
    const stories = await Story.find({ folderId: folder._id })
      .sort({ position: 1 })
      .lean();
    expect(stories.map(({ title, position }) => [title, position])).toEqual([
      ["A", 4],
      ["A (2)", 5],
      ["A (3)", 6],
    ]);
  });

  it("keeps a reproducible order in Newest first", async () => {
    const folder = await seedFolder(alice, "F");
    await importStories(
      { kind: "folder", id: folder._id.toString() },
      [chapter("1"), chapter("2"), chapter("3")],
      "",
    );
    const stories = await Story.find({ folderId: folder._id })
      .sort({ createdAt: -1 })
      .lean();
    expect(stories.map(({ title }) => title)).toEqual(["3", "2", "1"]);
  });

  it("picks an existing folder by name or creates one", async () => {
    const folder = await seedFolder(alice, "F");
    await importStories({ kind: "named", name: "F" }, [chapter("A")], "");
    await importStories({ kind: "named", name: "New" }, [chapter("B")], "");
    expect(await Story.countDocuments({ folderId: folder._id })).toBe(1);
    expect(await Folder.exists({ name: "New", userId: alice })).toBeTruthy();
  });

  it("appends folder notes to the notes of an existing folder", async () => {
    const folder = await seedFolder(alice, "F", "Stare");
    const empty = await seedFolder(alice, "E");
    await importStories(
      { kind: "folder", id: folder._id.toString() },
      [chapter("A")],
      "Nowe",
    );
    await importStories(
      { kind: "folder", id: empty._id.toString() },
      [chapter("A")],
      "Nowe",
    );
    const updated = await Folder.findById(folder._id).lean();
    expect(updated?.notes).toBe("Stare\n\nNowe");
    expect(updated?.notesUpdatedAt.getTime()).toBeGreaterThan(
      folder.notesUpdatedAt.getTime(),
    );
    expect((await Folder.findById(empty._id).lean())?.notes).toBe("Nowe");
  });

  it("refuses another user's and a deleted folder", async () => {
    const theirs = await seedFolder(bob, "Bob");
    const deleted = await Folder.create({
      userId: alice,
      name: "Gone",
      deletedAt: new Date(),
    });
    for (const { _id } of [theirs, deleted]) {
      const result = await importStories(
        { kind: "folder", id: _id.toString() },
        [chapter("A")],
        "Notes",
      );
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    }
    expect(await Story.countDocuments()).toBe(0);
    expect((await Folder.findById(theirs._id).lean())?.notes).toBe("");
  });

  it("takes the owner from the session, not from the payload", async () => {
    await importStories(
      { kind: "new", name: "F" },
      [{ ...chapter("A"), userId: bob.toString() } as never],
      "",
    );
    expect(await Story.countDocuments({ userId: bob })).toBe(0);
    expect(await Story.countDocuments({ userId: alice })).toBe(1);
  });

  it.each([
    ["no chapters", [], "INVALID_INPUT"],
    ["a malformed chapter", [{ title: "A" }], "INVALID_INPUT"],
    ["an empty title", [chapter("  ")], "EMPTY_TITLE"],
    [
      "too long a title",
      [chapter("x".repeat(MAX_IMPORT_TITLE_LENGTH + 1))],
      "INVALID_INPUT",
    ],
    [
      "too many chapters",
      Array.from({ length: MAX_IMPORT_CHAPTERS + 1 }, (_, index) =>
        chapter(String(index)),
      ),
      "INVALID_INPUT",
    ],
    [
      "too much text, counted in bytes",
      [chapter("A", "ż".repeat(MAX_IMPORT_TEXT_BYTES / 2 + 1))],
      "TOO_LARGE",
    ],
  ])("rejects %s and writes nothing", async (_, chapters, error) => {
    const result = await importStories(
      { kind: "new", name: "F" },
      chapters as never,
      "",
    );
    expect(result).toMatchObject({ ok: false, error });
    expect(await Folder.countDocuments()).toBe(0);
    expect(await Story.countDocuments()).toBe(0);
  });

  it("requires a folder name", async () => {
    const result = await importStories(
      { kind: "named", name: " " },
      [chapter("A")],
      "",
    );
    expect(result).toMatchObject({ ok: false, error: "EMPTY_NAME" });
  });
});
