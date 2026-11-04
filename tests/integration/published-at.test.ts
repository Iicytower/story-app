import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAllChapters,
  setFolderPublished,
} from "@/app/[locale]/(protected)/folders/actions";
import {
  deleteStory,
  moveStory,
  setChapterPublished,
} from "@/app/[locale]/(protected)/stories/actions";
import {
  createFolderVersion,
  restoreFolderVersion,
} from "@/app/[locale]/(protected)/folders/[id]/versions/actions";
import { requireUser } from "@/lib/auth/session";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const OLD = new Date("2026-01-01T00:00:00.000Z");
let alice: Types.ObjectId;

beforeEach(async () => {
  vi.useRealTimers();
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice.toString(),
  });
});

async function seedBook() {
  const folder = await Folder.create({ userId: alice, name: "Księga" });
  const ids: string[] = [];
  for (const [position, title] of ["One", "Two", "Three"].entries()) {
    const { _id } = await Story.create({
      userId: alice,
      folderId: folder._id,
      title,
      position,
    });
    await Story.collection.updateOne({ _id }, { $set: { updatedAt: OLD } });
    ids.push(_id.toString());
  }
  return { folderId: folder._id.toString(), ids };
}

async function chapter(id: string) {
  return (await Story.findById(id).lean())!;
}

async function dates(ids: string[]) {
  return Promise.all(ids.map(async (id) => (await chapter(id)).publishedAt));
}

// Each step at a new time, so a kept date differs from a new one.
let clock = Date.parse("2026-11-01T00:00:00.000Z");
function tick(): Date {
  clock += 60_000;
  vi.useFakeTimers({ now: clock, toFake: ["Date"] });
  return new Date(clock);
}

describe("publishedAt", () => {
  it("is set by Publish of the folder and removed by Unpublish", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[1], false);
    await setFolderPublished(folderId, false);

    const first = tick();
    await setFolderPublished(folderId, true);
    // Two keeps its explicit hidden state and gets no date.
    expect(await dates(ids)).toEqual([first, undefined, first]);

    tick();
    await setFolderPublished(folderId, false);
    expect(await dates(ids)).toEqual([undefined, undefined, undefined]);

    const again = tick();
    await setFolderPublished(folderId, true);
    expect(await dates(ids)).toEqual([again, undefined, again]);
  });

  it("is kept by Publish of an already published folder", async () => {
    const { folderId, ids } = await seedBook();
    const first = tick();
    await setFolderPublished(folderId, true);
    tick();
    await setFolderPublished(folderId, true);
    expect(await dates(ids)).toEqual([first, first, first]);
  });

  it("is set by Publish all only for chapters that were not public", async () => {
    const { folderId, ids } = await seedBook();
    const first = tick();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[0], false);
    const second = tick();
    await publishAllChapters(folderId);
    expect(await dates(ids)).toEqual([second, first, first]);
  });

  it("is set by Publish of a chapter only when it was not visible", async () => {
    const { folderId, ids } = await seedBook();
    const first = tick();
    await setFolderPublished(folderId, true);
    tick();
    await setChapterPublished(ids[0], true);
    expect((await chapter(ids[0])).publishedAt).toEqual(first);

    tick();
    await setChapterPublished(ids[0], false);
    expect((await chapter(ids[0])).publishedAt).toBeUndefined();
    const again = tick();
    await setChapterPublished(ids[0], true);
    expect((await chapter(ids[0])).publishedAt).toEqual(again);

    // A public chapter of an unpublished folder is not visible, so it gets a new date.
    tick();
    await setFolderPublished(folderId, false);
    const later = tick();
    await setChapterPublished(ids[1], true);
    expect(await dates(ids)).toEqual([undefined, later, undefined]);
  });

  it("is removed when a chapter is moved or a version brings it back hidden", async () => {
    const { folderId, ids } = await seedBook();
    await createFolderVersion(folderId, "One");
    await setFolderPublished(folderId, true);
    const other = await Folder.create({
      userId: alice,
      name: "Other",
      published: true,
    });
    await moveStory(ids[0], other._id.toString());
    expect(await chapter(ids[0])).toMatchObject({ publication: "hidden" });
    expect((await chapter(ids[0])).publishedAt).toBeUndefined();

    await deleteStory(ids[1]);
    expect((await chapter(ids[1])).publishedAt).toBeDefined();
    await restoreFolderVersion(folderId, 1, [ids[1]], []);
    expect(await chapter(ids[1])).toMatchObject({ publication: "hidden" });
    expect((await chapter(ids[1])).publishedAt).toBeUndefined();
  });

  it("does not change updatedAt", async () => {
    const { folderId, ids } = await seedBook();
    await setFolderPublished(folderId, true);
    await setChapterPublished(ids[0], false);
    await publishAllChapters(folderId);
    await setChapterPublished(ids[1], false);
    await setChapterPublished(ids[1], true);
    await setFolderPublished(folderId, false);
    for (const id of ids) expect((await chapter(id)).updatedAt).toEqual(OLD);
  });
});
