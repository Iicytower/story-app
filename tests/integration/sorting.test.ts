import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolder,
  reorderFolder,
  setChapterSort,
  setFolderSort,
} from "@/app/(protected)/folders/actions";
import {
  createStory,
  moveStory,
  reorderChapter,
  saveStory,
} from "@/app/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { getFolder, listFolders } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { Settings } from "@/lib/models/settings";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

let alice: Types.ObjectId;
let bob: Types.ObjectId;

function signInAs(userId: Types.ObjectId) {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: userId.toString(),
  });
}

beforeEach(async () => {
  [alice, bob] = (
    await User.create([
      { email: "alice@example.com", passwordHash: "x" },
      { email: "bob@example.com", passwordHash: "x" },
    ])
  ).map((user) => user._id);
  signInAs(alice);
});

async function seedFolder(name: string, lastActivityAt: Date, userId = alice) {
  const folder = await Folder.create({ userId, name, lastActivityAt });
  return folder._id;
}

async function seedStory(
  folderId: Types.ObjectId,
  title: string,
  createdAt: Date,
  userId = alice,
) {
  const { _id } = await Story.create({ userId, folderId, title });
  await Story.collection.updateOne({ _id }, { $set: { createdAt } });
  return _id;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const folderNames = async (userId = alice) =>
  (await listFolders(userId.toString())).folders.map((f) => f.name);

const chapterTitles = async (folderId: Types.ObjectId) =>
  (await getFolder(alice.toString(), folderId.toString()))!.chapters.map(
    (c) => c.title,
  );

describe("folder sort modes", () => {
  beforeEach(async () => {
    await seedFolder("banana", day(3));
    await seedFolder("Apple", day(1));
    await seedFolder("cherry", day(2));
  });

  it("defaults to the most recently active folder first", async () => {
    expect((await listFolders(alice.toString())).sort).toBe("updated");
    expect(await folderNames()).toEqual(["banana", "cherry", "Apple"]);
  });

  it("sorts A–Z ignoring case", async () => {
    await setFolderSort("alpha");
    expect(await folderNames()).toEqual(["Apple", "banana", "cherry"]);
  });

  it("keeps the shown order on the first switch to manual", async () => {
    await setFolderSort("alpha");
    await setFolderSort("manual");
    expect(await folderNames()).toEqual(["Apple", "banana", "cherry"]);
  });

  it("keeps the manual order after switching away and back", async () => {
    await setFolderSort("manual");
    const [, cherry] = (await listFolders(alice.toString())).folders;
    await reorderFolder(cherry.id, "up");
    await setFolderSort("alpha");
    await setFolderSort("manual");
    expect(await folderNames()).toEqual(["cherry", "banana", "Apple"]);
  });

  it("stores the mode in the user's settings", async () => {
    await setFolderSort("alpha");
    expect(await Settings.findOne({ userId: alice }).lean()).toMatchObject({
      folders: { sort: "alpha" },
    });
    expect((await listFolders(bob.toString())).sort).toBe("updated");
  });

  it("moves a folder up and down, and not past either end", async () => {
    await setFolderSort("manual");
    const [first, middle, last] = (await listFolders(alice.toString())).folders;

    expect(await reorderFolder(first.id, "up")).toEqual({ ok: true });
    expect(await reorderFolder(last.id, "down")).toEqual({ ok: true });
    expect(await folderNames()).toEqual(["banana", "cherry", "Apple"]);

    await reorderFolder(middle.id, "up");
    expect(await folderNames()).toEqual(["cherry", "banana", "Apple"]);
    await reorderFolder(middle.id, "down");
    await reorderFolder(middle.id, "down");
    expect(await folderNames()).toEqual(["banana", "Apple", "cherry"]);
  });

  it("adds a new folder at the end of the manual order", async () => {
    await setFolderSort("manual");
    await createFolder("Zeta");
    await createStory("Chapter", "Omega");
    expect(await folderNames()).toEqual([
      "banana",
      "cherry",
      "Apple",
      "Zeta",
      "Omega",
    ]);
  });

  it("repairs equal and missing positions when moving", async () => {
    await setFolderSort("manual");
    await Folder.updateMany({}, { $set: { position: 0 } });
    await Folder.collection.updateOne(
      { name: "cherry" },
      { $unset: { position: "" } },
    );
    const before = await folderNames();
    await reorderFolder(
      (await listFolders(alice.toString())).folders[2].id,
      "up",
    );
    expect(await folderNames()).toEqual([before[0], before[2], before[1]]);
  });

  it("does not change lastActivityAt", async () => {
    const before = await Folder.find().sort({ _id: 1 }).lean();
    await setFolderSort("manual");
    await reorderFolder(before[0]._id.toString(), "down");
    await setFolderSort("alpha");
    const after = await Folder.find().sort({ _id: 1 }).lean();
    expect(after.map((f) => f.lastActivityAt)).toEqual(
      before.map((f) => f.lastActivityAt),
    );
  });
});

describe("chapter sort modes", () => {
  let folderId: Types.ObjectId;

  beforeEach(async () => {
    folderId = await seedFolder("Book", day(1));
    await seedStory(folderId, "banana", day(1));
    await seedStory(folderId, "Apple", day(3));
    await seedStory(folderId, "cherry", day(2));
  });

  it("defaults to the newest chapter first", async () => {
    const folder = await getFolder(alice.toString(), folderId.toString());
    expect(folder?.chapterSort).toBe("created");
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "cherry",
      "banana",
    ]);
  });

  it("sorts A–Z ignoring case and stores the mode per folder", async () => {
    const other = await seedFolder("Other", day(1));
    await setChapterSort(folderId.toString(), "alpha");
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "banana",
      "cherry",
    ]);
    expect(await Folder.findById(folderId).lean()).toMatchObject({
      chapterSort: "alpha",
    });
    expect(await Folder.findById(other).lean()).toMatchObject({
      chapterSort: "created",
    });
  });

  it("keeps the shown order on the first switch to manual", async () => {
    await setChapterSort(folderId.toString(), "manual");
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "cherry",
      "banana",
    ]);
  });

  it("moves a chapter up and down, and not past either end", async () => {
    await setChapterSort(folderId.toString(), "manual");
    const [first, , last] = (await getFolder(
      alice.toString(),
      folderId.toString(),
    ))!.chapters;

    expect(await reorderChapter(first.id, "up")).toEqual({ ok: true });
    expect(await reorderChapter(last.id, "down")).toEqual({ ok: true });
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "cherry",
      "banana",
    ]);

    await reorderChapter(last.id, "up");
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "banana",
      "cherry",
    ]);
    await reorderChapter(first.id, "down");
    expect(await chapterTitles(folderId)).toEqual([
      "banana",
      "Apple",
      "cherry",
    ]);
  });

  it("adds new and moved-in chapters at the end of the manual order", async () => {
    await setChapterSort(folderId.toString(), "manual");
    await createStory("Zeta", "Book");
    const elsewhere = await seedStory(
      await seedFolder("Elsewhere", day(1)),
      "Omega",
      day(9),
    );
    await moveStory(elsewhere.toString(), folderId.toString());
    expect(await chapterTitles(folderId)).toEqual([
      "Apple",
      "cherry",
      "banana",
      "Zeta",
      "Omega",
    ]);
  });

  it("keeps updatedAt, so an open editor saves without CONFLICT", async () => {
    const [story] = await Story.find({ title: "Apple" }).lean();
    const folder = await Folder.findById(folderId).lean();

    await setChapterSort(folderId.toString(), "manual");
    await reorderChapter(story._id.toString(), "down");
    await setChapterSort(folderId.toString(), "alpha");

    const after = await Story.findById(story._id).lean();
    expect(after?.updatedAt).toEqual(story.updatedAt);
    expect(await Folder.findById(folderId).lean()).toMatchObject({
      lastActivityAt: folder!.lastActivityAt,
      notesUpdatedAt: folder!.notesUpdatedAt,
    });
    const saved = await saveStory(
      story._id.toString(),
      "Apple",
      "text",
      "",
      story.updatedAt.toISOString(),
    );
    expect(saved.ok).toBe(true);
  });
});

describe("alpha collation", () => {
  it("puts ł after l and before m, and treats a and A alike", async () => {
    for (const name of ["Mazury", "Łódź", "Lublin", "a", "A"]) {
      await seedFolder(name, day(1));
    }
    await setFolderSort("alpha");
    const names = await folderNames();
    expect(names.slice(2)).toEqual(["Lublin", "Łódź", "Mazury"]);
    // Equal under the collation, so the creation order (_id) breaks the tie.
    expect(names.slice(0, 2)).toEqual(["a", "A"]);
  });
});

describe("isolation and input", () => {
  it("returns NOT_FOUND for another user's folder or chapter", async () => {
    const bobsFolder = await seedFolder("Bob's", day(1), bob);
    const bobsStory = await seedStory(bobsFolder, "Secret", day(1), bob);
    const notFound = { ok: false, error: "NOT_FOUND" };

    expect(await setChapterSort(bobsFolder.toString(), "alpha")).toMatchObject(
      notFound,
    );
    expect(await reorderFolder(bobsFolder.toString(), "up")).toMatchObject(
      notFound,
    );
    expect(await reorderChapter(bobsStory.toString(), "up")).toMatchObject(
      notFound,
    );
    expect(await Folder.findById(bobsFolder).lean()).toMatchObject({
      chapterSort: "created",
    });
  });

  it("rejects an unknown mode or direction", async () => {
    const folderId = await seedFolder("Book", day(1));
    const storyId = await seedStory(folderId, "A", day(1));
    const invalid = { ok: false, error: "INVALID_INPUT" };

    expect(await setFolderSort("random")).toMatchObject(invalid);
    expect(await setChapterSort(folderId.toString(), "updated")).toMatchObject(
      invalid,
    );
    expect(
      await reorderFolder(folderId.toString(), "left" as "up"),
    ).toMatchObject(invalid);
    expect(
      await reorderChapter(storyId.toString(), "left" as "up"),
    ).toMatchObject(invalid);
  });
});
