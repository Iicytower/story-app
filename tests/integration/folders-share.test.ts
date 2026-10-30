import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteFolder,
  setFolderSharing,
} from "@/app/(protected)/folders/actions";
import { deleteStory, setSharing } from "@/app/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { getSharedChapter, getSharedFolder } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { getSharedStory } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

beforeEach(() => signInAs(alice));

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Chapters "First", "Second", "Third" created in that order, so newest first is reversed.
async function seedFolder(userId = alice) {
  const folder = await Folder.create({
    userId,
    name: "Book",
    notes: "secret folder note",
  });
  const ids: Types.ObjectId[] = [];
  for (const [index, title] of ["First", "Second", "Third"].entries()) {
    const { _id } = await Story.create({
      userId,
      folderId: folder._id,
      title,
      content: `${title} text <!-- hidden -->`,
      notes: "secret chapter note",
      position: index,
    });
    await Story.collection.updateOne(
      { _id },
      { $set: { createdAt: day(index + 1) } },
    );
    ids.push(_id);
  }
  return { folderId: folder._id.toString(), ids };
}

async function share(folderId: string) {
  const result = await setFolderSharing(folderId, true);
  if (!result.ok || !result.sharePath) throw new Error("Not shared");
  return result.sharePath.replace("/s/f/", "");
}

describe("setFolderSharing", () => {
  it("returns the same token when shared twice and removes it on stop", async () => {
    const { folderId } = await seedFolder();
    const first = await setFolderSharing(folderId, true);
    const second = await setFolderSharing(folderId, true);

    expect(first).toEqual({
      ok: true,
      sharePath: expect.stringMatching(/^\/s\/f\/[\w-]{22}$/),
    });
    expect(second).toEqual(first);

    const token = (first as { sharePath: string }).sharePath.slice(5);
    expect(await getSharedFolder(token)).not.toBeNull();
    expect(await setFolderSharing(folderId, false)).toEqual({
      ok: true,
      sharePath: null,
    });
    expect(await getSharedFolder(token)).toBeNull();
    expect(await getSharedChapter(token, 1)).toBeNull();
  });

  it("returns NOT_FOUND for another user's folder", async () => {
    const { folderId } = await seedFolder(bob);
    expect(await setFolderSharing(folderId, true)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(
      (await Folder.findById(folderId).lean())?.shareToken,
    ).toBeUndefined();
  });

  it("does not affect chapter sharing and vice versa", async () => {
    const { folderId, ids } = await seedFolder();
    const chapter = await setSharing(ids[0].toString(), true);
    const chapterToken = (chapter as { sharePath: string }).sharePath.slice(3);

    const token = await share(folderId);
    await setFolderSharing(folderId, false);
    expect(await getSharedStory(chapterToken)).not.toBeNull();

    const again = await share(folderId);
    await setSharing(ids[0].toString(), false);
    expect(await getSharedFolder(again)).not.toBeNull();
    expect(token).not.toBe(again);
  });

  it("keeps the folder's lastActivityAt", async () => {
    const { folderId } = await seedFolder();
    const before = await Folder.findById(folderId).lean();
    await share(folderId);
    expect((await Folder.findById(folderId).lean())?.lastActivityAt).toEqual(
      before?.lastActivityAt,
    );
  });
});

describe("shared folder pages", () => {
  it("lists chapters in the folder order without notes", async () => {
    const { folderId } = await seedFolder();
    const token = await share(folderId);

    expect(await getSharedFolder(token)).toEqual({
      name: "Book",
      chapters: [{ title: "Third" }, { title: "Second" }, { title: "First" }],
    });

    await Folder.updateOne({ _id: folderId }, { chapterSort: "manual" });
    expect((await getSharedFolder(token))?.chapters).toEqual([
      { title: "First" },
      { title: "Second" },
      { title: "Third" },
    ]);
  });

  it("returns chapter n with previous and next links", async () => {
    const { folderId } = await seedFolder();
    const token = await share(folderId);

    expect(await getSharedChapter(token, 2)).toEqual({
      folderName: "Book",
      title: "Second",
      content: "Second text <!-- hidden -->",
      previous: { n: 1, title: "Third" },
      next: { n: 3, title: "First" },
    });
    expect(await getSharedChapter(token, 1)).toMatchObject({
      previous: null,
      next: { n: 2 },
    });
    expect(await getSharedChapter(token, 3)).toMatchObject({
      previous: { n: 2 },
      next: null,
    });
    for (const n of [0, 4, 1.5, Number.NaN]) {
      expect(await getSharedChapter(token, n)).toBeNull();
    }
  });

  it("drops a deleted chapter and returns nothing for a deleted folder", async () => {
    const { folderId, ids } = await seedFolder();
    const token = await share(folderId);

    await deleteStory(ids[1].toString());
    expect((await getSharedFolder(token))?.chapters).toEqual([
      { title: "Third" },
      { title: "First" },
    ]);
    expect(await getSharedChapter(token, 3)).toBeNull();

    await deleteFolder(folderId);
    expect(await getSharedFolder(token)).toBeNull();
    expect(await getSharedChapter(token, 1)).toBeNull();
  });

  it("returns nothing for an unknown token", async () => {
    expect(await getSharedFolder("unknown-token-1234567")).toBeNull();
  });
});
