import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolderVersion,
  restoreEntireVersion,
} from "@/app/[locale]/(protected)/folders/[id]/versions/actions";
import {
  deleteFolder,
  setFolderTags,
} from "@/app/[locale]/(protected)/folders/actions";
import {
  deleteStory,
  moveStory,
  saveStory,
  setStoryTags,
} from "@/app/[locale]/(protected)/stories/actions";
import type { ActionError } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { getFolderForExport } from "@/lib/folders/queries";
import { Folder } from "@/lib/models/folder";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { FolderVersion } from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";
import { getStoryForExport, listStories } from "@/lib/stories/queries";
import { listUserTags } from "@/lib/tags/queries";
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

let counter = 0;

async function seedFolder(tags: string[] = [], userId = alice) {
  const folder = await Folder.create({
    userId,
    name: `Folder ${counter++}`,
    tags,
    lastActivityAt: OLD,
    notesUpdatedAt: OLD,
  });
  return folder._id.toString();
}

async function seedStory(
  folderId: string,
  title: string,
  fields: { tags?: string[]; content?: string; userId?: Types.ObjectId } = {},
) {
  const { _id } = await Story.create({
    userId: alice,
    folderId,
    title,
    ...fields,
  });
  await Story.collection.updateOne({ _id }, { $set: { updatedAt: OLD } });
  return _id.toString();
}

const many = (count: number, prefix = "t") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

const storyTags = async (id: string) => (await Story.findById(id).lean())?.tags;
const folderTags = async (id: string) =>
  (await Folder.findById(id).lean())?.tags;
const titles = (stories: { title: string }[]) =>
  stories.map(({ title }) => title).sort();

const seedPredefined = () =>
  PredefinedTag.create({
    _id: "sci-fi",
    labels: { en: "Science fiction", pl: "Fantastyka naukowa" },
  });

describe("predefined tags in the tag actions", () => {
  it("store a typed label as its key, once, and keep own tags", async () => {
    await seedPredefined();
    const folder = await seedFolder();
    const story = await seedStory(folder, "A");

    expect(
      await setFolderTags(folder, ["Science Fiction", "sci-fi", "scifi"]),
    ).toEqual({ ok: true });
    expect(await folderTags(folder)).toEqual(["sci-fi", "scifi"]);
    expect(await setStoryTags(story, ["fantastyka  naukowa"])).toEqual({
      ok: true,
    });
    expect(await storyTags(story)).toEqual(["sci-fi"]);
  });
});

describe("setFolderTags", () => {
  it("normalizes and replaces the tags", async () => {
    const id = await seedFolder(["old"]);
    expect(await setFolderTags(id, [" Fantasy", "fantasy", "Sci  Fi"])).toEqual(
      { ok: true },
    );
    expect(await folderTags(id)).toEqual(["fantasy", "sci fi"]);
  });

  it("does not change any date of the folder", async () => {
    const id = await seedFolder();
    const before = await Folder.findById(id).lean();
    await setFolderTags(id, ["a"]);
    const after = await Folder.findById(id).lean();
    expect(after?.updatedAt).toEqual(before?.updatedAt);
    expect(after?.lastActivityAt).toEqual(OLD);
    expect(after?.notesUpdatedAt).toEqual(OLD);
  });

  it("returns NOT_FOUND for a foreign, deleted or invalid folder", async () => {
    const foreign = await seedFolder(["bobs"], bob);
    const deleted = await seedFolder();
    await deleteFolder(deleted);

    for (const id of [foreign, deleted, "nope"]) {
      expect(await setFolderTags(id, ["a"])).toMatchObject({
        ok: false,
        error: "NOT_FOUND",
      });
    }
    expect(await folderTags(foreign)).toEqual(["bobs"]);
  });

  it("requires a session", async () => {
    const id = await seedFolder();
    signInAs(null);
    expect(await setFolderTags(id, ["a"])).toEqual(unauthorized);
  });

  it("rejects invalid tags", async () => {
    const id = await seedFolder();
    expect(await setFolderTags(id, many(11))).toMatchObject({
      error: "INVALID_INPUT",
    });
    expect(await setFolderTags(id, "a" as unknown as string[])).toMatchObject({
      error: "INVALID_INPUT",
    });
  });

  it("rejects tags that would put a chapter over the limit and names it", async () => {
    const id = await seedFolder();
    await seedStory(id, "Crowded", { tags: many(8) });

    expect(await setFolderTags(id, many(2, "f"))).toEqual({ ok: true });
    const result = await setFolderTags(id, many(3, "f"));
    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(!result.ok && result.message).toContain("Crowded");
    expect(await folderTags(id)).toEqual(many(2, "f"));
  });

  it("does not count tags shared with the chapter or deleted chapters", async () => {
    const id = await seedFolder();
    await seedStory(id, "Same", { tags: many(10) });
    const deleted = await seedStory(id, "Gone", { tags: many(10, "x") });
    await deleteStory(deleted);

    expect(await setFolderTags(id, many(3))).toEqual({ ok: true });
  });
});

describe("setStoryTags", () => {
  it("replaces the tags and keeps the dates, so an open editor can still save", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "Chapter", { tags: ["old"] });

    expect(await setStoryTags(id, ["New"])).toEqual({ ok: true });

    expect(await storyTags(id)).toEqual(["new"]);
    expect((await Story.findById(id).lean())?.updatedAt).toEqual(OLD);
    expect((await Folder.findById(folderId).lean())?.lastActivityAt).toEqual(
      OLD,
    );
    expect(await saveStory(id, "Chapter", "", "", OLD.toISOString())).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it("returns NOT_FOUND for a foreign, deleted or invalid story", async () => {
    const folderId = await seedFolder();
    const foreign = await seedStory(folderId, "Bob's", {
      userId: bob,
      tags: ["bobs"],
    });
    const deleted = await seedStory(folderId, "Gone");
    await deleteStory(deleted);

    for (const id of [foreign, deleted, "nope"]) {
      expect(await setStoryTags(id, ["a"])).toMatchObject({
        ok: false,
        error: "NOT_FOUND",
      });
    }
    expect(await storyTags(foreign)).toEqual(["bobs"]);
  });

  it("requires a session", async () => {
    const id = await seedStory(await seedFolder(), "Chapter");
    signInAs(null);
    expect(await setStoryTags(id, ["a"])).toEqual(unauthorized);
  });

  it("counts inherited tags towards the limit, shared ones once", async () => {
    const id = await seedStory(await seedFolder(many(4, "f")), "Chapter");

    expect(await setStoryTags(id, many(6))).toEqual({ ok: true });
    expect(await setStoryTags(id, many(7))).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(await setStoryTags(id, [...many(4, "f"), ...many(6)])).toEqual({
      ok: true,
    });
  });
});

describe("moveStory and the tag limit", () => {
  it("rejects a move over the limit and leaves the chapter in place", async () => {
    const from = await seedFolder();
    const to = await seedFolder(many(5, "f"));
    const id = await seedStory(from, "Chapter", { tags: many(6) });

    expect(await moveStory(id, to)).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect((await Story.findById(id).lean())?.folderId.toString()).toBe(from);
  });

  it("allows a move up to the limit", async () => {
    const to = await seedFolder(many(5, "f"));
    const id = await seedStory(await seedFolder(), "Chapter", {
      tags: many(5),
    });
    expect(await moveStory(id, to)).toEqual({ ok: true });
  });
});

describe("listStories with tags", () => {
  const list = (query: string | undefined, tags: string[]) =>
    listStories(alice.toString(), query, tags);

  it("matches own tags, tags inherited from the folder and needs all of them", async () => {
    const saga = await seedFolder(["fantasy"]);
    const other = await seedFolder();
    await seedStory(saga, "Inherited");
    await seedStory(saga, "Both", { tags: ["draft"] });
    await seedStory(other, "Own", { tags: ["fantasy"] });
    await seedStory(other, "Neither", { tags: ["draft"] });

    expect(titles(await list(undefined, ["fantasy"]))).toEqual([
      "Both",
      "Inherited",
      "Own",
    ]);
    expect(titles(await list(undefined, ["fantasy", "draft"]))).toEqual([
      "Both",
    ]);
  });

  it("works together with the search", async () => {
    const saga = await seedFolder(["fantasy"]);
    const other = await seedFolder();
    await seedStory(saga, "A", { content: "dragon" });
    await seedStory(saga, "B", { content: "cat" });
    await seedStory(other, "C", { content: "dragon" });

    expect(titles(await list("dragon", ["fantasy"]))).toEqual(["A"]);
  });

  it("finds whole tags with the search, also by a predefined label", async () => {
    await seedPredefined();
    const saga = await seedFolder(["sci-fi"]);
    const other = await seedFolder();
    await seedStory(saga, "Inherited", { content: "x" });
    await seedStory(other, "Own", { tags: ["sci-fi"], content: "x" });
    await seedStory(other, "Draft", { tags: ["draft"], content: "x" });
    await seedStory(other, "Part", { tags: ["drafts"], content: "x" });
    await seedStory(other, "None", { content: "x" });

    for (const query of ["Fantastyka naukowa", "science fiction", "SCI-FI"]) {
      expect(titles(await list(query, []))).toEqual(["Inherited", "Own"]);
    }
    // A whole tag only: "draft" is not part of "drafts".
    expect(titles(await list("Draft", []))).toEqual(["Draft"]);
    expect(titles(await list("Drafts", []))).toEqual(["Part"]);
  });

  it("returns the folder's tags with each story", async () => {
    await seedStory(await seedFolder(["fantasy"]), "A", { tags: ["own"] });
    expect(await list(undefined, ["own"])).toMatchObject([
      { tags: ["own"], folderTags: ["fantasy"] },
    ]);
  });

  it("skips deleted stories, deleted folders and other users", async () => {
    const saga = await seedFolder(["fantasy"]);
    await seedStory(saga, "Mine");
    const gone = await seedStory(saga, "Gone");
    await deleteStory(gone);
    await seedStory(await seedFolder(["fantasy"], bob), "Bob's", {
      userId: bob,
      tags: ["fantasy"],
    });
    const deleted = await seedFolder(["fantasy"]);
    await seedStory(deleted, "In deleted");
    await deleteFolder(deleted);

    expect(titles(await list(undefined, ["fantasy"]))).toEqual(["Mine"]);
  });
});

describe("listUserTags", () => {
  it("returns sorted own tags of active folders and chapters only", async () => {
    const folderId = await seedFolder(["zeta", "shared"]);
    await seedStory(folderId, "A", { tags: ["alpha", "shared"] });
    const gone = await seedStory(folderId, "Gone", { tags: ["deleted"] });
    await deleteStory(gone);
    const removed = await seedFolder(["removed"]);
    await deleteFolder(removed);
    await seedFolder(["bobs"], bob);

    expect(await listUserTags(alice.toString())).toEqual([
      "alpha",
      "shared",
      "zeta",
    ]);
  });
});

describe("tags outside the app's lists", () => {
  it("are not part of exports", async () => {
    const folderId = await seedFolder(["fantasy"]);
    const id = await seedStory(folderId, "A", { tags: ["own"] });

    const story = await getStoryForExport(alice.toString(), id);
    const folder = await getFolderForExport(alice.toString(), folderId);
    expect(story).not.toHaveProperty("tags");
    expect(folder).not.toHaveProperty("tags");
    expect(folder?.chapters[0]).not.toHaveProperty("tags");
  });

  it("are not stored in versions and survive restoring one", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A", { tags: ["before"] });
    const created = await createFolderVersion(folderId, "V1");
    expect(created.ok).toBe(true);
    await setStoryTags(id, ["after"]);

    const version = await FolderVersion.findOne({ folderId }).lean();
    expect(JSON.stringify(version)).not.toContain("before");
    await restoreEntireVersion(folderId, version!.number);

    expect(await storyTags(id)).toEqual(["after"]);
  });

  it("are copied with a chapter moved away and restored from a version", async () => {
    const folderId = await seedFolder();
    const id = await seedStory(folderId, "A", { tags: ["own"] });
    await createFolderVersion(folderId, "V1");
    await moveStory(id, await seedFolder());

    const version = await FolderVersion.findOne({ folderId }).lean();
    await restoreEntireVersion(folderId, version!.number);

    const copy = await Story.findOne({ folderId, title: "A" }).lean();
    expect(copy?._id.toString()).not.toBe(id);
    expect(copy?.tags).toEqual(["own"]);
  });
});
