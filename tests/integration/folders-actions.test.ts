import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolder,
  deleteFolder,
  renameFolder,
  saveFolderNotes,
} from "@/app/(protected)/folders/actions";
import { moveStory, saveStory } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { getSharedStory, getStory, listStories } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const OLD = new Date("2026-01-01T00:00:00.000Z");

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

async function seedFolder(name: string, userId = alice) {
  const folder = await Folder.create({
    userId,
    name,
    lastActivityAt: OLD,
    notesUpdatedAt: OLD,
  });
  return folder._id;
}

async function seedStory(
  folderId: Types.ObjectId,
  title: string,
  userId = alice,
  extra: Record<string, unknown> = {},
) {
  const { _id } = await Story.create({
    userId,
    folderId,
    title,
    content: `${title} content`,
    ...extra,
  });
  await Story.collection.updateOne({ _id }, { $set: { updatedAt: OLD } });
  return _id;
}

const folderDoc = (id: Types.ObjectId) => Folder.findById(id).lean();
const storyDoc = (id: Types.ObjectId) => Story.findById(id).lean();

describe("createFolder", () => {
  it("creates a folder with a trimmed name", async () => {
    const result = await createFolder("  Drafts ");

    expect(result.ok).toBe(true);
    const folder = await Folder.findById(result.ok ? result.id : "").lean();
    expect(folder).toMatchObject({
      userId: alice,
      name: "Drafts",
      notes: "",
      deletedAt: null,
    });
  });

  it.each(["", "  "])("rejects an empty name %j", async (name) => {
    expect(await createFolder(name)).toMatchObject({ error: "EMPTY_NAME" });
    expect(await Folder.countDocuments()).toBe(0);
  });

  it("rejects a duplicate name and allows the name of a deleted folder or of another user", async () => {
    await createFolder("Drafts");
    expect(await createFolder("Drafts")).toMatchObject({
      ok: false,
      error: "DUPLICATE_NAME",
    });

    const id = await seedFolder("Old");
    await deleteFolder(id.toString());
    expect(await createFolder("Old")).toMatchObject({ ok: true });

    signInAs(bob);
    expect(await createFolder("Drafts")).toMatchObject({ ok: true });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    signInAs(null);
    expect(await createFolder("Drafts")).toEqual(unauthorized);
  });
});

describe("renameFolder", () => {
  it("renames the folder without touching its chapters", async () => {
    const folderId = await seedFolder("Drafts");
    const storyId = await seedStory(folderId, "Chapter");

    expect(await renameFolder(folderId.toString(), " Book ")).toEqual({
      ok: true,
    });

    expect((await folderDoc(folderId))?.name).toBe("Book");
    expect((await storyDoc(storyId))?.updatedAt).toEqual(OLD);
  });

  it("returns DUPLICATE_NAME and EMPTY_NAME", async () => {
    const folderId = await seedFolder("Drafts");
    await seedFolder("Book");

    expect(await renameFolder(folderId.toString(), "Book")).toMatchObject({
      error: "DUPLICATE_NAME",
    });
    expect(await renameFolder(folderId.toString(), " ")).toMatchObject({
      error: "EMPTY_NAME",
    });
    expect((await folderDoc(folderId))?.name).toBe("Drafts");
  });

  it("returns NOT_FOUND for another user's or a deleted folder", async () => {
    const bobs = await seedFolder("Bob's", bob);
    const deleted = await seedFolder("Gone");
    await deleteFolder(deleted.toString());

    for (const id of [bobs.toString(), deleted.toString(), "nope"]) {
      expect(await renameFolder(id, "Taken")).toMatchObject({
        error: "NOT_FOUND",
      });
    }
    expect((await folderDoc(bobs))?.name).toBe("Bob's");
  });
});

describe("deleteFolder", () => {
  it("soft deletes the folder and its chapters without changing their updatedAt", async () => {
    const folderId = await seedFolder("Drafts");
    const storyId = await seedStory(folderId, "Chapter", alice, {
      shareToken: "token-1234567890abcdef",
    });
    const otherFolder = await seedFolder("Other");
    const otherStory = await seedStory(otherFolder, "Kept");

    expect(await deleteFolder(folderId.toString())).toEqual({ ok: true });

    expect((await folderDoc(folderId))?.deletedAt).toBeInstanceOf(Date);
    const story = await storyDoc(storyId);
    expect(story?.deletedAt).toBeInstanceOf(Date);
    expect(story?.updatedAt).toEqual(OLD);
    expect((await storyDoc(otherStory))?.deletedAt).toBeNull();
  });

  it("hides the folder and its chapters everywhere", async () => {
    const folderId = await seedFolder("Drafts");
    const storyId = await seedStory(folderId, "Dragon", alice, {
      shareToken: "token-1234567890abcdef",
    });

    await deleteFolder(folderId.toString());

    const userId = alice.toString();
    expect((await listFolders(userId)).folders).toEqual([]);
    expect(await getFolder(userId, folderId.toString())).toBeNull();
    expect(await listStories(userId, "Dragon")).toEqual([]);
    expect(await getStory(userId, storyId.toString())).toBeNull();
    expect(await getSharedStory("token-1234567890abcdef")).toBeNull();
  });

  it("returns NOT_FOUND for another user's folder and leaves it intact", async () => {
    const bobs = await seedFolder("Bob's", bob);
    const storyId = await seedStory(bobs, "Bob's chapter", bob);

    expect(await deleteFolder(bobs.toString())).toMatchObject({
      error: "NOT_FOUND",
    });
    expect((await folderDoc(bobs))?.deletedAt).toBeNull();
    expect((await storyDoc(storyId))?.deletedAt).toBeNull();
  });
});

describe("saveFolderNotes", () => {
  it("saves the notes and returns a newer notesUpdatedAt", async () => {
    const folderId = await seedFolder("Drafts");

    const result = await saveFolderNotes(
      folderId.toString(),
      "Plot",
      OLD.toISOString(),
    );

    expect(result.ok).toBe(true);
    const folder = await folderDoc(folderId);
    expect(folder?.notes).toBe("Plot");
    expect(result.ok && result.notesUpdatedAt).toBe(
      folder?.notesUpdatedAt.toISOString(),
    );
    expect(folder!.notesUpdatedAt.getTime()).toBeGreaterThan(OLD.getTime());
    expect(folder?.lastActivityAt).toEqual(folder?.notesUpdatedAt);

    const next = await saveFolderNotes(
      folderId.toString(),
      "Plot 2",
      result.ok ? result.notesUpdatedAt : "",
    );
    expect(next.ok).toBe(true);
  });

  it("returns CONFLICT for an outdated notesUpdatedAt and keeps the notes", async () => {
    const folderId = await seedFolder("Drafts");
    await saveFolderNotes(folderId.toString(), "From tab A", OLD.toISOString());

    expect(
      await saveFolderNotes(
        folderId.toString(),
        "From tab B",
        OLD.toISOString(),
      ),
    ).toMatchObject({ ok: false, error: "CONFLICT" });
    expect((await folderDoc(folderId))?.notes).toBe("From tab A");
  });

  it("does not conflict after a chapter autosave", async () => {
    const folderId = await seedFolder("Drafts");
    const storyId = await seedStory(folderId, "Chapter");

    const saved = await saveStory(
      storyId.toString(),
      "Chapter",
      "New text",
      "",
      OLD.toISOString(),
    );
    expect(saved.ok).toBe(true);
    const folder = await folderDoc(folderId);
    expect(folder?.notesUpdatedAt).toEqual(OLD);
    expect(folder?.lastActivityAt.toISOString()).toBe(
      saved.ok && saved.updatedAt,
    );

    expect(
      await saveFolderNotes(folderId.toString(), "Notes", OLD.toISOString()),
    ).toMatchObject({ ok: true });
  });

  it("returns NOT_FOUND for another user's or a deleted folder", async () => {
    const bobs = await seedFolder("Bob's", bob);
    const deleted = await seedFolder("Gone");
    await deleteFolder(deleted.toString());

    for (const id of [bobs, deleted]) {
      expect(
        await saveFolderNotes(id.toString(), "Hijack", OLD.toISOString()),
      ).toMatchObject({ error: "NOT_FOUND" });
    }
    expect((await folderDoc(bobs))?.notes).toBe("");
  });

  it("returns UNAUTHORIZED without a session", async () => {
    const folderId = await seedFolder("Drafts");
    signInAs(null);
    expect(
      await saveFolderNotes(folderId.toString(), "x", OLD.toISOString()),
    ).toEqual(unauthorized);
  });
});

describe("moveStory", () => {
  it("moves the chapter without changing its updatedAt and touches the target folder", async () => {
    const from = await seedFolder("From");
    const to = await seedFolder("To");
    const storyId = await seedStory(from, "Chapter");

    expect(await moveStory(storyId.toString(), to.toString())).toEqual({
      ok: true,
    });

    const story = await storyDoc(storyId);
    expect(story?.folderId).toEqual(to);
    expect(story?.updatedAt).toEqual(OLD);
    expect((await folderDoc(to))!.lastActivityAt.getTime()).toBeGreaterThan(
      OLD.getTime(),
    );
  });

  it("returns DUPLICATE_TITLE when the target folder has the title", async () => {
    const from = await seedFolder("From");
    const to = await seedFolder("To");
    const storyId = await seedStory(from, "Prologue");
    await seedStory(to, "Prologue");

    expect(await moveStory(storyId.toString(), to.toString())).toMatchObject({
      error: "DUPLICATE_TITLE",
    });
    expect((await storyDoc(storyId))?.folderId).toEqual(from);
  });

  it("cannot move another user's chapter or into another user's folder", async () => {
    const mine = await seedFolder("Mine");
    const myStory = await seedStory(mine, "Mine");
    const bobs = await seedFolder("Bob's", bob);
    const bobsStory = await seedStory(bobs, "Bob's", bob);

    expect(await moveStory(myStory.toString(), bobs.toString())).toMatchObject({
      error: "NOT_FOUND",
    });
    expect(
      await moveStory(bobsStory.toString(), mine.toString()),
    ).toMatchObject({ error: "NOT_FOUND" });
    expect((await storyDoc(myStory))?.folderId).toEqual(mine);
    expect((await storyDoc(bobsStory))?.folderId).toEqual(bobs);
  });

  it("returns NOT_FOUND for a deleted target folder", async () => {
    const from = await seedFolder("From");
    const gone = await seedFolder("Gone");
    await deleteFolder(gone.toString());
    const storyId = await seedStory(from, "Chapter");

    expect(await moveStory(storyId.toString(), gone.toString())).toMatchObject({
      error: "NOT_FOUND",
    });
  });
});

describe("folder queries", () => {
  it("lists folders by lastActivityAt with chapter counts", async () => {
    const older = await seedFolder("Older");
    const newer = await seedFolder("Newer");
    await Folder.updateOne(
      { _id: newer },
      { $set: { lastActivityAt: new Date("2026-02-01") } },
    );
    await seedStory(older, "A");
    await seedStory(older, "B");
    await seedStory(older, "Deleted", alice, { deletedAt: new Date() });
    await seedFolder("Bob's", bob);

    const { folders } = await listFolders(alice.toString());
    expect(folders.map((f) => [f.name, f.chapterCount])).toEqual([
      ["Newer", 0],
      ["Older", 2],
    ]);
  });

  it("returns the folder with its chapters, newest first, only for the owner", async () => {
    const folderId = await seedFolder("Drafts");
    const first = await seedStory(folderId, "First");
    await Story.updateOne(
      { _id: first },
      { $set: { createdAt: new Date("2026-01-01") } },
      { timestamps: false },
    );
    await seedStory(folderId, "Second");

    const folder = await getFolder(alice.toString(), folderId.toString());
    expect(folder?.chapters.map((c) => c.title)).toEqual(["Second", "First"]);
    expect(await getFolder(bob.toString(), folderId.toString())).toBeNull();
  });

  it("shows the folder name in search results", async () => {
    const folderId = await seedFolder("Book");
    await seedStory(folderId, "Dragon");

    expect(await listStories(alice.toString(), "dragon")).toMatchObject([
      { title: "Dragon", folderName: "Book" },
    ]);
  });

  it("returns the folder of a story for the editor", async () => {
    const folderId = await seedFolder("Book");
    const storyId = await seedStory(folderId, "Chapter");

    expect(await getStory(alice.toString(), storyId.toString())).toMatchObject({
      folderId: folderId.toString(),
      folderName: "Book",
    });
  });
});
