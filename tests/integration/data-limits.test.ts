import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFolderVersion,
  restoreEntireVersion,
} from "@/app/[locale]/(protected)/books/[id]/versions/actions";
import {
  createFolder,
  renameFolder,
  saveFolderNotes,
} from "@/app/[locale]/(protected)/books/actions";
import {
  createStory,
  importStories,
  moveStory,
  saveStory,
} from "@/app/[locale]/(protected)/chapters/actions";
import { requireUser } from "@/lib/auth/session";
import {
  MAX_CHAPTERS_PER_FOLDER,
  MAX_CONTENT_LENGTH,
  MAX_FOLDERS,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_VERSIONS_PER_FOLDER,
} from "@/lib/limits";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Story } from "@/lib/models/story";
import { getStory } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const alice = new Types.ObjectId();
const OLD = new Date("2026-01-01T00:00:00.000Z");
const text = (length: number) => "a".repeat(length);

let folderId: string;
let storyId: string;

beforeEach(async () => {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice.toString(),
  });
  const folder = await Folder.create({
    userId: alice,
    name: "Book",
    lastActivityAt: OLD,
    notesUpdatedAt: OLD,
  });
  folderId = folder._id.toString();
  storyId = (
    await Story.create({ userId: alice, folderId: folder._id, title: "One" })
  )._id.toString();
});

const updatedAt = async (id = storyId) =>
  (await Story.findById(id).lean())!.updatedAt.toISOString();

function invalid(message: RegExp) {
  return {
    ok: false,
    error: "INVALID_INPUT",
    message: expect.stringMatching(message),
  };
}

describe("length limits", () => {
  it("folder names: createFolder, renameFolder, createStory, import", async () => {
    const long = text(MAX_NAME_LENGTH + 1);
    const tooLong = invalid(/book name can have at most 200 characters/);
    expect(await createFolder(long)).toMatchObject(tooLong);
    expect(await renameFolder(folderId, long)).toMatchObject(tooLong);
    expect(await createStory("T", long)).toMatchObject(tooLong);
    expect(
      await importStories(
        { kind: "new", name: long },
        [{ title: "T", content: "c", notes: "" }],
        "",
      ),
    ).toMatchObject(tooLong);
    expect(await Folder.countDocuments()).toBe(1);

    const fits = text(MAX_NAME_LENGTH);
    expect(await createFolder(fits)).toMatchObject({ ok: true });
    expect(
      await renameFolder(folderId, ` ${text(MAX_NAME_LENGTH - 1)}b `),
    ).toEqual({
      ok: true,
    });
  });

  it("chapter titles: createStory and saveStory", async () => {
    const long = text(MAX_NAME_LENGTH + 1);
    const tooLong = invalid(/title can have at most 200 characters/);
    expect(await createStory(long, "Book")).toMatchObject(tooLong);
    expect(
      await saveStory(storyId, long, "c", "", await updatedAt()),
    ).toMatchObject(tooLong);
    expect(
      await saveStory(
        storyId,
        text(MAX_NAME_LENGTH),
        "c",
        "",
        await updatedAt(),
      ),
    ).toMatchObject({ ok: true });
  });

  it("chapter content and notes in saveStory", async () => {
    expect(
      await saveStory(
        storyId,
        "One",
        text(MAX_CONTENT_LENGTH + 1),
        "",
        await updatedAt(),
      ),
    ).toMatchObject(invalid(/chapter can have at most 500,000 characters/));
    expect(
      await saveStory(
        storyId,
        "One",
        "c",
        text(MAX_NOTES_LENGTH + 1),
        await updatedAt(),
      ),
    ).toMatchObject(
      invalid(/Chapter notes can have at most 100,000 characters/),
    );
    expect((await Story.findById(storyId).lean())!.content).toBe("");
  });

  it("folder notes in saveFolderNotes and in import", async () => {
    const tooLong = invalid(/Book notes can have at most 100,000 characters/);
    expect(
      await saveFolderNotes(
        folderId,
        text(MAX_NOTES_LENGTH + 1),
        OLD.toISOString(),
      ),
    ).toMatchObject(tooLong);
    await Folder.updateOne(
      { _id: folderId },
      { notes: text(MAX_NOTES_LENGTH - 5) },
    );
    expect(
      await importStories(
        { kind: "folder", id: folderId },
        [{ title: "T", content: "c", notes: "" }],
        "more notes",
      ),
    ).toMatchObject(tooLong);
    expect(await Story.countDocuments()).toBe(1);
  });

  it("imported chapters over the content or notes limit", async () => {
    const target = { kind: "new", name: "Imported" } as const;
    expect(
      await importStories(
        target,
        [{ title: "Long", content: text(MAX_CONTENT_LENGTH + 1), notes: "" }],
        "",
      ),
    ).toMatchObject(invalid(/Chapter “Long” is too long/));
    expect(
      await importStories(
        target,
        [{ title: "Notes", content: "c", notes: text(MAX_NOTES_LENGTH + 1) }],
        "",
      ),
    ).toMatchObject(invalid(/notes of chapter “Notes” are too long/));
    expect(await Folder.countDocuments()).toBe(1);
  });

  it("existing data over the limit opens and can be shortened", async () => {
    await Story.updateOne(
      { _id: storyId },
      {
        content: text(MAX_CONTENT_LENGTH + 10),
        notes: text(MAX_NOTES_LENGTH + 10),
      },
    );
    const story = await getStory(alice.toString(), storyId);
    expect(story?.content).toHaveLength(MAX_CONTENT_LENGTH + 10);
    expect(
      await saveStory(
        storyId,
        "One",
        text(MAX_CONTENT_LENGTH + 5),
        text(MAX_NOTES_LENGTH),
        await updatedAt(),
      ),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(
      await saveStory(
        storyId,
        "One",
        text(MAX_CONTENT_LENGTH),
        text(MAX_NOTES_LENGTH),
        await updatedAt(),
      ),
    ).toMatchObject({ ok: true });
  });
});

describe("count limits", () => {
  it("folders per user", async () => {
    await Folder.insertMany(
      Array.from({ length: MAX_FOLDERS - 1 }, (_, index) => ({
        userId: alice,
        name: `F${index}`,
      })),
    );
    const tooMany = invalid(/at most 1,000 books/);
    expect(await createFolder("New")).toMatchObject(tooMany);
    expect(await createStory("T", "New")).toMatchObject(tooMany);
    expect(
      await importStories(
        { kind: "new", name: "New" },
        [{ title: "T", content: "c", notes: "" }],
        "",
      ),
    ).toMatchObject(tooMany);
    // An existing folder still takes chapters.
    expect(await createStory("T", "Book")).toMatchObject({ ok: true });
    // Deleted folders do not count.
    await Folder.updateOne({ name: "F0" }, { deletedAt: new Date() });
    expect(await createFolder("New")).toMatchObject({ ok: true });
  });

  it("chapters per folder", async () => {
    await Story.insertMany(
      Array.from({ length: MAX_CHAPTERS_PER_FOLDER - 1 }, (_, index) => ({
        userId: alice,
        folderId,
        title: `C${index}`,
      })),
    );
    const tooMany = invalid(/at most 500 chapters/);
    expect(await createStory("T", "Book")).toMatchObject(tooMany);
    expect(
      await importStories(
        { kind: "folder", id: folderId },
        [{ title: "T", content: "c", notes: "" }],
        "",
      ),
    ).toMatchObject(tooMany);
    const other = await Folder.create({ userId: alice, name: "Other" });
    const outside = await Story.create({
      userId: alice,
      folderId: other._id,
      title: "Out",
    });
    expect(await moveStory(outside._id.toString(), folderId)).toMatchObject(
      tooMany,
    );
    expect(await moveStory(storyId, other._id.toString())).toMatchObject({
      ok: true,
    });
    expect(await moveStory(outside._id.toString(), folderId)).toMatchObject({
      ok: true,
    });
  });

  it("versions per folder block saving and restoring", async () => {
    expect(await createFolderVersion(folderId, "first")).toMatchObject({
      ok: true,
      number: 1,
    });
    const first = await FolderVersion.findOne({ number: 1 }).lean();
    await FolderVersion.insertMany(
      Array.from({ length: MAX_VERSIONS_PER_FOLDER - 1 }, (_, index) => ({
        ...first,
        _id: new Types.ObjectId(),
        number: index + 2,
      })),
    );
    await Folder.updateOne(
      { _id: folderId },
      { versionCounter: MAX_VERSIONS_PER_FOLDER },
    );
    const tooMany = invalid(/at most 100 versions. Delete an old version/);
    expect(await createFolderVersion(folderId, "more")).toMatchObject(tooMany);
    expect(await restoreEntireVersion(folderId, 1)).toMatchObject(tooMany);
    expect(await FolderVersion.countDocuments()).toBe(MAX_VERSIONS_PER_FOLDER);
  });
});
