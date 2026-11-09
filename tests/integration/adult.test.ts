import path from "node:path";
import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setFolderAdult,
  setFolderPublished,
} from "@/app/[locale]/(protected)/folders/actions";
import {
  moveStory,
  setStoryAdult,
} from "@/app/[locale]/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { loadMigrations, runMigrations } from "@/lib/migrate";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import {
  getPublishedChapter,
  getPublishedFolder,
  listRecentlyPublished,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import { getStory, listStories } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const OLD = new Date("2026-01-01T00:00:00.000Z");
let alice: Types.ObjectId;
let bob: Types.ObjectId;

function signInAs(userId: Types.ObjectId) {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: userId.toString(),
  });
}

beforeEach(async () => {
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
  bob = (await User.create({ nickname: "Bob", passwordHash: "x" }))._id;
  signInAs(alice);
});

async function seed(userId = alice) {
  const folder = await Folder.create({
    userId,
    name: "Księga",
    lastActivityAt: OLD,
  });
  const story = await Story.create({
    userId,
    folderId: folder._id,
    title: "One",
    content: "One text",
  });
  await Story.collection.updateOne(
    { _id: story._id },
    { $set: { updatedAt: OLD } },
  );
  await Folder.collection.updateOne(
    { _id: folder._id },
    { $set: { updatedAt: OLD } },
  );
  return { folderId: folder._id.toString(), storyId: story._id.toString() };
}

// Stands in for the image filter of task 26.
async function setAuto(model: "folder" | "story", id: string, auto: boolean) {
  const collection = model === "folder" ? Folder : Story;
  await collection.collection.updateOne(
    { _id: new Types.ObjectId(id) },
    { $set: { "adult.auto": auto } },
  );
}

async function chapterState(storyId: string) {
  return (await getStory(alice.toString(), storyId))!.adult;
}

async function folderState(folderId: string) {
  return (await getFolder(alice.toString(), folderId))!.adult;
}

describe("setFolderAdult", () => {
  it("marks and unmarks the folder, and its chapters inherit it", async () => {
    const { folderId, storyId } = await seed();
    expect(await setFolderAdult(folderId, true)).toEqual({ ok: true });
    expect(await folderState(folderId)).toEqual({ adult: true, lock: null });
    expect(await chapterState(storyId)).toEqual({
      adult: true,
      lock: "folder",
    });

    expect(await setFolderAdult(folderId, false)).toEqual({ ok: true });
    expect(await folderState(folderId)).toEqual({ adult: false, lock: null });
    expect(await chapterState(storyId)).toEqual({ adult: false, lock: null });
  });

  it("returns NOT_FOUND for another user's folder", async () => {
    const { folderId } = await seed(bob);
    const result = await setFolderAdult(folderId, true);
    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect((await Folder.findById(folderId).lean())!.adult).toBeUndefined();
  });

  it("keeps updatedAt and lastActivityAt", async () => {
    const { folderId } = await seed();
    await setFolderAdult(folderId, true);
    const folder = (await Folder.findById(folderId).lean())!;
    expect(folder.updatedAt).toEqual(OLD);
    expect(folder.lastActivityAt).toEqual(OLD);
  });

  it("cannot remove an automatic mark; after the source goes the manual one stays", async () => {
    const { folderId } = await seed();
    await setFolderAdult(folderId, true);
    await setAuto("folder", folderId, true);
    expect(await folderState(folderId)).toEqual({ adult: true, lock: "auto" });
    expect(await setFolderAdult(folderId, false)).toMatchObject({
      ok: false,
      error: "ADULT_LOCKED",
    });

    await setAuto("folder", folderId, false);
    expect(await folderState(folderId)).toEqual({ adult: true, lock: null });
  });

  it("drops the mark when the automatic source goes without a manual one", async () => {
    const { folderId } = await seed();
    await setAuto("folder", folderId, true);
    await setAuto("folder", folderId, false);
    expect(await folderState(folderId)).toEqual({ adult: false, lock: null });
  });
});

describe("setStoryAdult", () => {
  it("marks and unmarks the chapter without marking the folder", async () => {
    const { folderId, storyId } = await seed();
    expect(await setStoryAdult(storyId, true)).toEqual({ ok: true });
    expect(await chapterState(storyId)).toEqual({ adult: true, lock: null });
    expect(await folderState(folderId)).toEqual({ adult: false, lock: null });

    expect(await setStoryAdult(storyId, false)).toEqual({ ok: true });
    expect(await chapterState(storyId)).toEqual({ adult: false, lock: null });
  });

  it("returns NOT_FOUND for another user's chapter", async () => {
    const { storyId } = await seed(bob);
    expect(await setStoryAdult(storyId, true)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("keeps updatedAt, so an open editor does not get CONFLICT", async () => {
    const { storyId } = await seed();
    await setStoryAdult(storyId, true);
    expect((await Story.findById(storyId).lean())!.updatedAt).toEqual(OLD);
  });

  it("cannot remove 18+ inherited from the folder", async () => {
    const { folderId, storyId } = await seed();
    await setFolderAdult(folderId, true);
    expect(await setStoryAdult(storyId, false)).toMatchObject({
      ok: false,
      error: "ADULT_LOCKED",
    });
  });

  it("cannot remove an automatic mark of the chapter", async () => {
    const { storyId } = await seed();
    await setAuto("story", storyId, true);
    expect(await chapterState(storyId)).toEqual({ adult: true, lock: "auto" });
    expect(await setStoryAdult(storyId, false)).toMatchObject({
      ok: false,
      error: "ADULT_LOCKED",
    });
    await setAuto("story", storyId, false);
    expect(await chapterState(storyId)).toEqual({ adult: false, lock: null });
  });
});

describe("moving a chapter", () => {
  it("inherits from the new folder and keeps its own mark", async () => {
    const { folderId, storyId } = await seed();
    const other = {
      folderId: (
        await Folder.create({ userId: alice, name: "Druga" })
      )._id.toString(),
    };
    await setFolderAdult(folderId, true);
    expect(await chapterState(storyId)).toMatchObject({ adult: true });

    expect(await moveStory(storyId, other.folderId)).toEqual({ ok: true });
    expect(await chapterState(storyId)).toEqual({ adult: false, lock: null });

    await setStoryAdult(storyId, true);
    expect(await moveStory(storyId, folderId)).toEqual({ ok: true });
    expect(await moveStory(storyId, other.folderId)).toEqual({ ok: true });
    expect(await chapterState(storyId)).toEqual({ adult: true, lock: null });
  });
});

describe("owner and public views", () => {
  it("show the mark in lists, the folder page and public pages", async () => {
    const { folderId, storyId } = await seed();
    await setFolderPublished(folderId, true);
    await setStoryAdult(storyId, true);

    const { folders } = await listFolders(alice.toString());
    expect(folders[0].adult.adult).toBe(false);
    expect(
      (await getFolder(alice.toString(), folderId))!.chapters[0].adult,
    ).toEqual({ adult: true, lock: null });
    expect((await listStories(alice.toString()))[0].adult).toBe(true);

    const folder = await getPublishedFolder("Alice", "ksiega");
    expect(folder).toMatchObject({
      adult: false,
      chapters: [{ title: "One", adult: true }],
    });
    expect(await getPublishedChapter("Alice", "ksiega", "one")).toMatchObject({
      adult: true,
    });
    expect(await searchPublishedChapters("One", [])).toMatchObject([
      { title: "One", adult: true },
    ]);
    expect(await listRecentlyPublished()).toMatchObject([
      { title: "One", adult: true },
    ]);
  });

  it("marks every public chapter of an 18+ folder", async () => {
    const { folderId } = await seed();
    await setFolderPublished(folderId, true);
    await setFolderAdult(folderId, true);
    expect(await searchPublishedChapters("", [])).toMatchObject([
      { adult: true },
    ]);
    expect(await getPublishedFolder("Alice", "ksiega")).toMatchObject({
      adult: true,
    });
  });
});

describe("migrations", () => {
  it("leave nothing marked as 18+", async () => {
    const db = mongoose.connection.db!;
    const { insertedId: folderId } = await db
      .collection("folders")
      .insertOne({ userId: alice, name: "Stary", deletedAt: null });
    const { insertedId: storyId } = await db.collection("stories").insertOne({
      userId: alice,
      folderId,
      title: "Old",
      content: "x",
      deletedAt: null,
    });
    await runMigrations(
      mongoose.connection,
      await loadMigrations(path.resolve("migrations")),
      () => {},
    );

    expect(await folderState(folderId.toString())).toEqual({
      adult: false,
      lock: null,
    });
    expect(await chapterState(storyId.toString())).toEqual({
      adult: false,
      lock: null,
    });
  });
});
