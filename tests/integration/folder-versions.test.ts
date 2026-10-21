import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolderVersion,
  deleteFolderVersion,
  restoreFolderVersion,
} from "@/app/(protected)/folders/[id]/versions/actions";
import { deleteFolder } from "@/app/(protected)/folders/actions";
import { saveStory } from "@/app/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { ChapterContent } from "@/lib/models/chapter-content";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";
import { getFolderVersion, listFolderVersions } from "@/lib/versions/queries";
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

async function seedFolder(name = "Book", userId = alice) {
  const { _id } = await Folder.create({
    userId,
    name,
    notes: "Folder notes v1",
    chapterSort: "manual",
    manualChapterOrder: true,
  });
  return _id;
}

let position = 0;
async function seedStory(
  folderId: Types.ObjectId,
  title: string,
  userId = alice,
) {
  const { _id } = await Story.create({
    userId,
    folderId,
    title,
    content: `${title} content`,
    notes: `${title} notes`,
    position: position++,
  });
  await Story.collection.updateOne({ _id }, { $set: { updatedAt: OLD } });
  return _id;
}

const story = (id: Types.ObjectId) => Story.findById(id).lean();
const versionDoc = (folderId: Types.ObjectId, number: number) =>
  FolderVersion.findOne({ folderId, number }).lean();
const versionNames = async (folderId: Types.ObjectId) =>
  (await FolderVersion.find({ folderId }).sort({ number: 1 }).lean()).map(
    ({ number, name }) => [number, name],
  );

async function edit(id: Types.ObjectId, fields: Record<string, unknown>) {
  await Story.collection.updateOne({ _id: id }, { $set: fields });
}

describe("createFolderVersion", () => {
  it("saves every active chapter in the order shown and the folder notes", async () => {
    const folderId = await seedFolder();
    const other = await seedFolder("Other");
    const second = await seedStory(folderId, "Second");
    const first = await seedStory(folderId, "First");
    await Story.collection.updateOne({ _id: first }, { $set: { position: -1 } });
    const deleted = await seedStory(folderId, "Deleted");
    await edit(deleted, { deletedAt: new Date() });
    await seedStory(other, "Elsewhere");

    const result = await createFolderVersion(folderId.toString(), "  Draft ");

    expect(result).toEqual({ ok: true, number: 1 });
    const version = await versionDoc(folderId, 1);
    expect(version).toMatchObject({
      userId: alice,
      name: "Draft",
      folderNotes: "Folder notes v1",
    });
    expect(
      version!.chapters.map(({ storyId, title, position }) => [
        storyId,
        title,
        position,
      ]),
    ).toEqual([
      [first, "First", 0],
      [second, "Second", 1],
    ]);
    const contents = await ChapterContent.find({
      _id: { $in: version!.chapters.map((c) => c.contentId) },
    }).lean();
    expect(
      contents.map(({ title, content, notes }) => ({ title, content, notes })),
    ).toEqual(
      expect.arrayContaining([
        { title: "First", content: "First content", notes: "First notes" },
        { title: "Second", content: "Second content", notes: "Second notes" },
      ]),
    );
  });

  it("does not change the folder's or chapters' updatedAt", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "One");
    await Folder.collection.updateOne(
      { _id: folderId },
      { $set: { updatedAt: OLD } },
    );

    await createFolderVersion(folderId.toString(), "Draft");

    expect((await Folder.findById(folderId).lean())!.updatedAt).toEqual(OLD);
    expect((await story(id))!.updatedAt).toEqual(OLD);
  });

  it("requires a name", async () => {
    const folderId = await seedFolder();

    expect(await createFolderVersion(folderId.toString(), "  ")).toMatchObject(
      { ok: false, error: "EMPTY_NAME" },
    );
    expect(await FolderVersion.countDocuments()).toBe(0);
    expect(await createFolderVersion(folderId.toString(), "Next")).toEqual({
      ok: true,
      number: 1,
    });
  });

  it("reuses the stored state of a chapter that did not change", async () => {
    const folderId = await seedFolder();
    const same = await seedStory(folderId, "Same");
    const changed = await seedStory(folderId, "Changed");

    await createFolderVersion(folderId.toString(), "One");
    await edit(changed, { content: "Rewritten" });
    await createFolderVersion(folderId.toString(), "Two");

    const [one, two] = [
      await versionDoc(folderId, 1),
      await versionDoc(folderId, 2),
    ];
    const contentOf = (
      version: typeof one,
      id: Types.ObjectId,
    ): string | undefined =>
      version!.chapters.find((c) => c.storyId.equals(id))?.contentId;
    expect(contentOf(two, same)).toBe(contentOf(one, same));
    expect(contentOf(two, changed)).not.toBe(contentOf(one, changed));
    expect(await ChapterContent.countDocuments()).toBe(3);
  });

  it("gives parallel saves different numbers", async () => {
    const folderId = await seedFolder();
    await seedStory(folderId, "One");

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createFolderVersion(folderId.toString(), `V${i}`),
      ),
    );

    expect(
      results.map((r) => (r.ok ? r.number : 0)).sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(await ChapterContent.countDocuments()).toBe(1);
  });

  it("does not reuse the number of a deleted version", async () => {
    const folderId = await seedFolder();
    await createFolderVersion(folderId.toString(), "One");
    await createFolderVersion(folderId.toString(), "Two");
    await deleteFolderVersion(folderId.toString(), 2);

    expect(await createFolderVersion(folderId.toString(), "Three")).toEqual({
      ok: true,
      number: 3,
    });
  });
});

describe("listFolderVersions", () => {
  it("lists the folder's versions, newest first, with chapter counts", async () => {
    const folderId = await seedFolder();
    await createFolderVersion(folderId.toString(), "Empty");
    await seedStory(folderId, "One");
    await createFolderVersion(folderId.toString(), "With one");

    expect(
      (await listFolderVersions(alice.toString(), folderId.toString())).map(
        ({ number, name, chapterCount }) => ({ number, name, chapterCount }),
      ),
    ).toEqual([
      { number: 2, name: "With one", chapterCount: 1 },
      { number: 1, name: "Empty", chapterCount: 0 },
    ]);
  });
});

describe("getFolderVersion", () => {
  it("compares the version with the current chapters", async () => {
    const folderId = await seedFolder();
    const other = await seedFolder("Other");
    const same = await seedStory(folderId, "Same");
    const changed = await seedStory(folderId, "Changed");
    const deleted = await seedStory(folderId, "Deleted");
    const moved = await seedStory(folderId, "Moved");
    await createFolderVersion(folderId.toString(), "One");
    await edit(changed, { content: "Changed content, rewritten" });
    await edit(deleted, { deletedAt: new Date() });
    await edit(moved, { folderId: other });
    const added = await seedStory(folderId, "Added");
    await Folder.updateOne({ _id: folderId }, { notes: "Folder notes v2" });

    const view = await getFolderVersion(
      alice.toString(),
      folderId.toString(),
      1,
    );

    expect(view).toMatchObject({ number: 1, name: "One" });
    expect(
      view!.comparison.chapters.map(({ storyId, status }) => [storyId, status]),
    ).toEqual([
      [same.toString(), "unchanged"],
      [changed.toString(), "changed"],
      [deleted.toString(), "deleted"],
      [moved.toString(), "deleted"],
    ]);
    const diff = view!.comparison.chapters[1];
    expect(diff.status === "changed" && diff.diffs).toEqual([
      {
        field: "content",
        parts: [
          { value: "Changed content", added: false, removed: false },
          { value: ", rewritten", added: true, removed: false },
        ],
      },
    ]);
    expect(view!.comparison.added).toEqual([
      { id: added.toString(), title: "Added" },
    ]);
    expect(view!.folderNotesDiff).toEqual([
      { value: "Folder notes ", added: false, removed: false },
      { value: "v1", added: false, removed: true },
      { value: "v2", added: true, removed: false },
    ]);
  });
});

describe("restoreFolderVersion", () => {
  it("restores only the selected chapter after saving the current state", async () => {
    const folderId = await seedFolder();
    const a = await seedStory(folderId, "A");
    const b = await seedStory(folderId, "B");
    await createFolderVersion(folderId.toString(), "One");
    await edit(a, { title: "A renamed", content: "A new", notes: "A new notes" });
    await edit(b, { content: "B new" });

    const result = await restoreFolderVersion(folderId.toString(), 1, [
      a.toString(),
    ]);

    expect(result).toEqual({ ok: true, savedNumber: 2 });
    expect(await story(a)).toMatchObject({
      title: "A",
      content: "A content",
      notes: "A notes",
      deletedAt: null,
    });
    expect((await story(a))!.updatedAt.getTime()).toBeGreaterThan(
      OLD.getTime(),
    );
    expect((await story(b))!.content).toBe("B new");
    expect(await versionNames(folderId)).toEqual([
      [1, "One"],
      [2, "Before restoring version 1"],
    ]);
    const before = await getFolderVersion(
      alice.toString(),
      folderId.toString(),
      2,
    );
    expect(
      before!.comparison.chapters.map(({ title, status }) => [title, status]),
    ).toEqual([
      ["A renamed", "changed"],
      ["B", "unchanged"],
    ]);
  });

  it("restores several chapters and all of them", async () => {
    const folderId = await seedFolder();
    const ids = [
      await seedStory(folderId, "A"),
      await seedStory(folderId, "B"),
      await seedStory(folderId, "C"),
    ];
    await createFolderVersion(folderId.toString(), "One");
    for (const id of ids) await edit(id, { content: "edited" });

    await restoreFolderVersion(folderId.toString(), 1, [
      ids[0].toString(),
      ids[2].toString(),
    ]);
    expect(
      (await Promise.all(ids.map(story))).map((s) => s!.content),
    ).toEqual(["A content", "edited", "C content"]);

    await restoreFolderVersion(
      folderId.toString(),
      1,
      ids.map((id) => id.toString()),
    );
    expect(
      (await Promise.all(ids.map(story))).map((s) => s!.content),
    ).toEqual(["A content", "B content", "C content"]);
  });

  it("makes an open editor's next save a conflict", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A");
    await createFolderVersion(folderId.toString(), "One");

    await restoreFolderVersion(folderId.toString(), 1, [id.toString()]);

    expect(
      await saveStory(id.toString(), "A", "typed", "", OLD.toISOString()),
    ).toMatchObject({ ok: false, error: "CONFLICT" });
    expect((await story(id))!.content).toBe("A content");
  });

  it("brings back a deleted chapter at the end of the folder", async () => {
    const folderId = await seedFolder();
    const deleted = await seedStory(folderId, "Gone");
    await seedStory(folderId, "Stays");
    await createFolderVersion(folderId.toString(), "One");
    await edit(deleted, { deletedAt: new Date(), shareToken: "token" });

    await restoreFolderVersion(folderId.toString(), 1, [deleted.toString()]);

    const restored = await story(deleted);
    expect(restored).toMatchObject({
      folderId,
      title: "Gone",
      content: "Gone content",
      deletedAt: null,
    });
    expect(restored!.shareToken).toBeUndefined();
    expect(restored!.position).toBe(position);
    const view = await getFolderVersion(
      alice.toString(),
      folderId.toString(),
      1,
    );
    expect(view!.comparison.chapters.map((c) => c.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
  });

  it("copies back a chapter moved to another folder", async () => {
    const folderId = await seedFolder();
    const other = await seedFolder("Other");
    const moved = await seedStory(folderId, "Moved");
    await createFolderVersion(folderId.toString(), "One");
    await edit(moved, { folderId: other, content: "Moved and edited" });

    await restoreFolderVersion(folderId.toString(), 1, [moved.toString()]);

    expect(await story(moved)).toMatchObject({
      folderId: other,
      content: "Moved and edited",
    });
    expect(
      await Story.findOne({ folderId, deletedAt: null }).lean(),
    ).toMatchObject({ title: "Moved", content: "Moved content", userId: alice });
  });

  it("adds a number when the title is taken in the folder", async () => {
    const folderId = await seedFolder();
    const old = await seedStory(folderId, "Title");
    await createFolderVersion(folderId.toString(), "One");
    await edit(old, { deletedAt: new Date() });
    const taken = await seedStory(folderId, "Title");

    await restoreFolderVersion(folderId.toString(), 1, [old.toString()]);

    expect((await story(old))!.title).toBe("Title (2)");
    expect((await story(taken))!.title).toBe("Title");
  });

  it("rejects an empty selection and chapters outside the version", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A");
    await createFolderVersion(folderId.toString(), "One");
    const later = await seedStory(folderId, "Later");

    for (const ids of [[], [id.toString(), later.toString()], ["x"]]) {
      expect(
        await restoreFolderVersion(folderId.toString(), 1, ids),
      ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    }
    expect(await FolderVersion.countDocuments()).toBe(1);
  });
});

describe("deleteFolderVersion", () => {
  it("removes the version and the contents no other version uses", async () => {
    const folderId = await seedFolder();
    const same = await seedStory(folderId, "Same");
    const changed = await seedStory(folderId, "Changed");
    await createFolderVersion(folderId.toString(), "One");
    await edit(changed, { content: "Rewritten" });
    await createFolderVersion(folderId.toString(), "Two");
    const two = await versionDoc(folderId, 2);

    expect(await deleteFolderVersion(folderId.toString(), 1)).toEqual({
      ok: true,
    });

    expect(await versionNames(folderId)).toEqual([[2, "Two"]]);
    expect(
      (await ChapterContent.find().lean()).map((c) => c._id).sort(),
    ).toEqual(two!.chapters.map((c) => c.contentId).sort());
    expect(await versionDoc(folderId, 2)).toEqual(two);
    expect((await story(same))!.updatedAt).toEqual(OLD);
    expect((await story(changed))!.content).toBe("Rewritten");
  });

  it("keeps a content that a version saved meanwhile points to", async () => {
    const folderId = await seedFolder();
    await seedStory(folderId, "A");
    await createFolderVersion(folderId.toString(), "One");
    await ChapterContent.updateMany(
      {},
      { $set: { usedAt: new Date(Date.now() + 60_000) } },
    );

    await deleteFolderVersion(folderId.toString(), 1);

    expect(await ChapterContent.countDocuments()).toBe(1);
  });

  it("returns NOT_FOUND for a missing version", async () => {
    const folderId = await seedFolder();

    expect(await deleteFolderVersion(folderId.toString(), 1)).toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
  });
});

describe("access", () => {
  it("hides another user's versions", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A");
    await createFolderVersion(folderId.toString(), "One");
    signInAs(bob);
    const folder = folderId.toString();

    expect(await getFolderVersion(bob.toString(), folder, 1)).toBeNull();
    expect(await listFolderVersions(bob.toString(), folder)).toEqual([]);
    for (const result of [
      await createFolderVersion(folder, "Mine"),
      await restoreFolderVersion(folder, 1, [id.toString()]),
      await deleteFolderVersion(folder, 1),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    }
    expect(await versionNames(folderId)).toEqual([[1, "One"]]);
  });

  it("hides the versions of a deleted folder", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A");
    await createFolderVersion(folderId.toString(), "One");
    await deleteFolder(folderId.toString());
    const folder = folderId.toString();

    expect(await getFolderVersion(alice.toString(), folder, 1)).toBeNull();
    for (const result of [
      await createFolderVersion(folder, "Two"),
      await restoreFolderVersion(folder, 1, [id.toString()]),
      await deleteFolderVersion(folder, 1),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    }
    expect(await FolderVersion.countDocuments()).toBe(1);
  });

  it("requires a session", async () => {
    const folderId = await seedFolder();
    signInAs(null);

    expect(await createFolderVersion(folderId.toString(), "One")).toEqual(
      unauthorized,
    );
    expect(await restoreFolderVersion(folderId.toString(), 1, [])).toEqual(
      unauthorized,
    );
    expect(await deleteFolderVersion(folderId.toString(), 1)).toEqual(
      unauthorized,
    );
  });
});
