import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteFolder,
  publishAllChapters,
  renameFolder,
  setFolderPublished,
} from "@/app/[locale]/(protected)/folders/actions";
import {
  createStory,
  deleteStory,
  importStories,
  moveStory,
  saveStory,
  setChapterPublished,
} from "@/app/[locale]/(protected)/stories/actions";
import {
  createFolderVersion,
  restoreFolderVersion,
} from "@/app/[locale]/(protected)/folders/[id]/versions/actions";
import { requireUser } from "@/lib/auth/session";
import { getFolder, getFolderForExport } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { getPublishedChapter, getPublishedFolder } from "@/lib/publish/queries";
import { getStory } from "@/lib/stories/queries";
import { listFolderVersions } from "@/lib/versions/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const OLD = new Date("2026-01-01T00:00:00.000Z");
let alice: Types.ObjectId;
let bob: Types.ObjectId;

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

beforeEach(async () => {
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
  bob = (await User.create({ nickname: "Bob", passwordHash: "x" }))._id;
  signInAs(alice);
});

async function seedBook(userId = alice) {
  const folder = await Folder.create({
    userId,
    name: "Księga",
    notes: "secret folder note",
    lastActivityAt: OLD,
  });
  const ids: string[] = [];
  for (const [position, title] of ["One", "Two", "Three"].entries()) {
    const { _id } = await Story.create({
      userId,
      folderId: folder._id,
      title,
      content: `${title} text <!-- secret comment -->`,
      notes: "secret chapter note",
      position,
    });
    await Story.collection.updateOne(
      { _id },
      {
        $set: {
          createdAt: new Date(OLD.getTime() + position),
          updatedAt: OLD,
        },
      },
    );
    ids.push(_id.toString());
  }
  await Folder.updateOne(
    { _id: folder._id },
    { $set: { chapterSort: "manual", manualChapterOrder: true } },
  );
  return { folderId: folder._id.toString(), ids };
}

const titles = async (slug = "ksiega") =>
  (await getPublishedFolder("Alice", slug))?.chapters.map((c) => c.title);

describe("before publishing", () => {
  it("shows nothing, also for a document with an old shareToken", async () => {
    const { ids } = await seedBook();
    await Story.collection.updateOne(
      { _id: new Types.ObjectId(ids[0]) },
      { $set: { shareToken: "old-token-1234567890" } },
    );
    expect(await getPublishedFolder("Alice", "ksiega")).toBeNull();
    expect(await getPublishedChapter("Alice", "ksiega", "one")).toBeNull();
    expect((await getStory(alice.toString(), ids[0]))?.publicPath).toBeNull();
  });
});

describe("setFolderPublished", () => {
  it("makes undecided chapters public and unpublishing takes the pages away", async () => {
    const { folderId } = await seedBook();
    expect(await setFolderPublished(folderId, true)).toEqual({ ok: true });
    expect(await titles()).toEqual(["One", "Two", "Three"]);
    expect(await setFolderPublished(folderId, false)).toEqual({ ok: true });
    expect(await getPublishedFolder("Alice", "ksiega")).toBeNull();
    expect(await getPublishedChapter("Alice", "ksiega", "one")).toBeNull();
  });

  it("keeps an excluded chapter hidden after publishing again", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[1], false);
    await setFolderPublished(folderId, false);
    await setFolderPublished(folderId, true);
    expect(await titles()).toEqual(["One", "Three"]);
  });

  it("does not change updatedAt, lastActivityAt or notesUpdatedAt", async () => {
    const { folderId, ids } = await seedBook();
    await createFolderVersion(folderId, "One");
    const userId = alice.toString();
    const before = await Folder.findById(folderId).lean();
    const exportBefore = await getFolderForExport(userId, folderId);
    const versionsBefore = await listFolderVersions(userId, folderId);
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[0], false);
    await publishAllChapters(folderId);
    expect(await getFolderForExport(userId, folderId)).toEqual(exportBefore);
    expect(await listFolderVersions(userId, folderId)).toEqual(versionsBefore);
    const after = await Folder.findById(folderId).lean();
    expect(after).toMatchObject({
      updatedAt: before!.updatedAt,
      lastActivityAt: before!.lastActivityAt,
      notesUpdatedAt: before!.notesUpdatedAt,
    });
    expect((await Story.findById(ids[0]).lean())?.updatedAt).toEqual(OLD);
  });
});

describe("setChapterPublished", () => {
  it("publishes the folder with only this chapter on", async () => {
    const { folderId, ids } = await seedBook();
    const result = await setChapterPublished(ids[1], true);
    expect(result).toEqual({ ok: true, publicPath: "/p/Alice/ksiega/two" });
    expect(await titles()).toEqual(["Two"]);
    expect((await getFolder(alice.toString(), folderId))?.published).toBe(true);
  });

  it("leaves the other chapters of a published folder alone", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[0], false);
    await setChapterPublished(ids[0], true);
    expect(await titles()).toEqual(["One", "Two", "Three"]);
    await setChapterPublished(ids[1], false);
    await setChapterPublished(ids[0], true);
    expect(await titles()).toEqual(["One", "Three"]);
  });

  it("publishes only this chapter after the folder was unpublished", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setFolderPublished(folderId, false);
    await setChapterPublished(ids[1], true);
    expect(await titles()).toEqual(["Two"]);
  });

  it("gives readers no folder once the last public chapter is hidden", async () => {
    const { ids } = await seedBook();
    await setChapterPublished(ids[0], true);
    await setChapterPublished(ids[0], false);
    expect(await getPublishedFolder("Alice", "ksiega")).toBeNull();
  });
});

describe("reading order", () => {
  it("starts from the oldest chapter in Newest first", async () => {
    const { folderId } = await seedBook();
    await Folder.updateOne({ _id: folderId }, { chapterSort: "created" });
    await setFolderPublished(folderId, true);
    expect(await titles()).toEqual(["One", "Two", "Three"]);
    const chapter = await getPublishedChapter("Alice", "ksiega", "two");
    expect(chapter?.previous?.title).toBe("One");
    expect(chapter?.next?.title).toBe("Three");
  });

  it("keeps the author's order in Manual", async () => {
    const { folderId, ids } = await seedBook();
    await Story.updateOne({ _id: ids[0] }, { position: 9 });
    await setFolderPublished(folderId, true);
    expect(await titles()).toEqual(["Two", "Three", "One"]);
  });
});

describe("publishAllChapters", () => {
  it("makes hidden chapters public", async () => {
    const { folderId, ids } = await seedBook();
    await setChapterPublished(ids[0], true);
    expect(await publishAllChapters(folderId)).toEqual({ ok: true });
    expect(await titles()).toEqual(["One", "Two", "Three"]);
  });

  it("does nothing for an unpublished folder", async () => {
    const { folderId } = await seedBook();
    expect(await publishAllChapters(folderId)).toMatchObject({
      error: "NOT_FOUND",
    });
  });
});

describe("ownership", () => {
  it("returns NOT_FOUND for another user's chapter and folder", async () => {
    const { folderId, ids } = await seedBook(bob);
    for (const result of [
      await setChapterPublished(ids[0], true),
      await setChapterPublished(ids[0], false),
      await setFolderPublished(folderId, true),
      await setFolderPublished(folderId, false),
      await publishAllChapters(folderId),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    }
    expect(await getPublishedFolder("Bob", "ksiega")).toBeNull();
  });

  it("returns UNAUTHORIZED without a session", async () => {
    const { folderId, ids } = await seedBook();
    signInAs(null);
    const unauthorized = { ok: false, error: "UNAUTHORIZED" };
    expect(await setChapterPublished(ids[0], true)).toMatchObject(unauthorized);
    expect(await setFolderPublished(folderId, true)).toMatchObject(
      unauthorized,
    );
    expect(await publishAllChapters(folderId)).toMatchObject(unauthorized);
  });
});

describe("chapters arriving in a published folder", () => {
  it("are hidden when created, imported or moved", async () => {
    const { folderId } = await seedBook();
    await setFolderPublished(folderId, true);
    await createStory("Created", "Księga");
    await importStories(
      { kind: "folder", id: folderId },
      [{ title: "Imported", content: "text", notes: "" }],
      "",
    );
    const other = await Folder.create({ userId: alice, name: "Other" });
    const moved = await Story.create({
      userId: alice,
      folderId: other._id,
      title: "Moved",
      publication: "public",
    });
    await moveStory(moved._id.toString(), folderId);
    expect(await titles()).toEqual(["One", "Two", "Three"]);
  });

  it("are hidden when a version brings them back", async () => {
    const { folderId, ids } = await seedBook();
    await createFolderVersion(folderId, "One");
    await setFolderPublished(folderId, true);
    await deleteStory(ids[0]);
    await restoreFolderVersion(folderId, 1, [ids[0]], []);
    expect(await titles()).toEqual(["Two", "Three"]);
  });

  it("are undecided in an unpublished folder", async () => {
    const { folderId, ids } = await seedBook();
    const published = await Folder.create({
      userId: alice,
      name: "Live",
      published: true,
    });
    await moveStory(ids[0], published._id.toString());
    expect((await Story.findById(ids[0]).lean())?.publication).toBe("hidden");
    await moveStory(ids[0], folderId);
    expect((await Story.findById(ids[0]).lean())?.publication).toBeUndefined();
  });
});

describe("deleted chapters and folders", () => {
  it("stop being available", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await deleteStory(ids[0]);
    expect(await getPublishedChapter("Alice", "ksiega", "one")).toBeNull();
    expect(await titles()).toEqual(["Two", "Three"]);
    await deleteFolder(folderId);
    expect(await getPublishedFolder("Alice", "ksiega")).toBeNull();
    expect(await getPublishedChapter("Alice", "ksiega", "two")).toBeNull();
  });
});

describe("public content", () => {
  it("has the nickname and no private data", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[1], false);
    await Story.updateOne({ _id: ids[0] }, { tags: ["secret-tag"] });

    const folder = await getPublishedFolder("alice", "ksiega");
    const chapter = await getPublishedChapter("alice", "ksiega", "three");
    expect(folder).toMatchObject({
      nickname: "Alice",
      name: "Księga",
      path: "/p/Alice/ksiega",
    });
    expect(chapter).toMatchObject({
      nickname: "Alice",
      path: "/p/Alice/ksiega/three",
      previous: { title: "One", path: "/p/Alice/ksiega/one" },
      next: null,
    });
    const text = JSON.stringify([folder, chapter]);
    for (const secret of [
      alice.toString(),
      folderId,
      ids[0],
      "secret chapter note",
      "secret folder note",
      "secret-tag",
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("addresses", () => {
  it("separates same titles by folder and same slugs by suffix", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    const other = await Folder.create({
      userId: alice,
      name: "Ksiega",
      published: true,
    });
    await Story.create({
      userId: alice,
      folderId: other._id,
      title: "One",
      publication: "public",
    });
    expect((await getPublishedFolder("Alice", "ksiega-2"))?.name).toBe(
      "Ksiega",
    );
    expect((await getPublishedChapter("Alice", "ksiega-2", "one"))?.path).toBe(
      "/p/Alice/ksiega-2/one",
    );
    expect((await getStory(alice.toString(), ids[0]))?.publicPath).toBe(
      "/p/Alice/ksiega/one",
    );
  });

  it("keeps the old chapter address after a title change", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await saveStory(ids[0], "New title", "text", "", OLD.toISOString());
    const chapter = await getPublishedChapter("Alice", "ksiega", "one");
    expect(chapter?.path).toBe("/p/Alice/ksiega/new-title");
    expect(
      (await getPublishedChapter("Alice", "ksiega", "new-title"))?.title,
    ).toBe("New title");
  });

  it("keeps the old folder address after a rename", async () => {
    const { folderId } = await seedBook();
    await setFolderPublished(folderId, true);
    await renameFolder(folderId, "Saga");
    expect((await getPublishedFolder("Alice", "ksiega"))?.path).toBe(
      "/p/Alice/saga",
    );
  });

  it("gives a new chapter a former address back to itself, not a redirect", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await saveStory(ids[0], "New title", "text", "", OLD.toISOString());
    await createStory("One", "Księga");
    const created = await Story.findOne({ title: "One" }).lean();
    await setChapterPublished(created!._id.toString(), true);
    const chapter = await getPublishedChapter("Alice", "ksiega", "one");
    expect(chapter?.path).toBe("/p/Alice/ksiega/one");
    expect(chapter?.title).toBe("One");
  });
});
