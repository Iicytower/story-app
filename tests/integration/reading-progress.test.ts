import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToLibrary } from "@/app/[locale]/(protected)/library/actions";
import { setChapterPublished } from "@/app/[locale]/(protected)/stories/actions";
import { saveReadingPosition } from "@/app/[locale]/p/[nickname]/[folder]/[chapter]/actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { publishedReaderChapters } from "@/lib/publish/queries";
import {
  folderReading,
  libraryReading,
  savedPosition,
} from "@/lib/reading/queries";
import { purgeSocialData } from "@/lib/social/cascade";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const NOT_FOUND = {
  ok: false,
  error: "NOT_FOUND",
  message: en.errors.storyNotFound,
};
const INVALID = {
  ok: false,
  error: "INVALID_INPUT",
  message: en.errors.requestInvalid,
};

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;

async function createUser(nickname: string) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
  });
  return insertedId;
}

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

async function seedBook(name = "Book", titles = ["One", "Two"]) {
  const folder = await Folder.create({
    userId: alice,
    name,
    published: true,
  });
  const chapters = [];
  for (const title of titles) {
    chapters.push(
      await Story.create({
        userId: alice,
        folderId: folder._id,
        title,
        content: "text",
        publication: "public",
        publishedAt: new Date(Date.now() - DAY),
      }),
    );
  }
  return {
    id: folder._id.toString(),
    folder: folder._id,
    chapters: chapters.map(({ _id }) => _id.toString()),
  };
}

const progressOf = (userId = dave) =>
  ReadingProgress.find(
    { userId },
    { _id: 0, folderId: 1, lastStoryId: 1, position: 1, readStoryIds: 1 },
  ).lean();

async function newCount(book: { id: string }) {
  const reading = await libraryReading(dave.toString(), [
    { folderId: book.id, path: "/p/Alice/book" },
  ]);
  return reading.get(book.id)!.newChapterIds.length;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  signInAs(dave);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveReadingPosition", () => {
  it("saves the last chapter and position, and the end of a chapter marks it read", async () => {
    const book = await seedBook();
    const [one, two] = book.chapters;
    expect(await saveReadingPosition(one, 0.4)).toEqual({ ok: true });
    expect(await progressOf()).toEqual([
      {
        folderId: book.folder,
        lastStoryId: new Types.ObjectId(one),
        position: 0.4,
        readStoryIds: [],
      },
    ]);

    expect(await saveReadingPosition(one, 1)).toEqual({ ok: true });
    expect(await saveReadingPosition(two, 0.2)).toEqual({ ok: true });
    // Saving the read chapter again does not list it twice.
    expect(await saveReadingPosition(one, 1)).toEqual({ ok: true });
    expect(await saveReadingPosition(two, 0.5)).toEqual({ ok: true });
    expect(await progressOf()).toEqual([
      {
        folderId: book.folder,
        lastStoryId: new Types.ObjectId(two),
        position: 0.5,
        readStoryIds: [new Types.ObjectId(one)],
      },
    ]);
    expect(await savedPosition(dave.toString(), book.id, two)).toBe(0.5);
    expect(await savedPosition(dave.toString(), book.id, one)).toBeNull();
    // Another account's progress is its own (D1).
    expect(await savedPosition(erin.toString(), book.id, two)).toBeNull();
  });

  it("gives NOT_FOUND for a chapter that is not public, deleted or missing", async () => {
    const book = await seedBook("Book", ["One", "Hidden", "Deleted"]);
    const [one, hidden, deleted] = book.chapters;
    await Story.updateOne({ _id: hidden }, { publication: "hidden" });
    await Story.updateOne({ _id: deleted }, { deletedAt: new Date() });
    expect(await saveReadingPosition(hidden, 0.5)).toEqual(NOT_FOUND);
    expect(await saveReadingPosition(deleted, 0.5)).toEqual(NOT_FOUND);
    expect(
      await saveReadingPosition(new Types.ObjectId().toString(), 0.5),
    ).toEqual(NOT_FOUND);

    await Folder.updateOne({ _id: book.folder }, { published: false });
    expect(await saveReadingPosition(one, 0.5)).toEqual(NOT_FOUND);
    await Folder.updateOne(
      { _id: book.folder },
      { published: true, deletedAt: new Date() },
    );
    expect(await saveReadingPosition(one, 0.5)).toEqual(NOT_FOUND);
    expect(await ReadingProgress.countDocuments()).toBe(0);
  });

  it("gives NOT_FOUND for a book of a blocked or globally banned author", async () => {
    const [one] = (await seedBook()).chapters;
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await saveReadingPosition(one, 0.5)).toEqual(NOT_FOUND);
    signInAs(erin);
    expect(await saveReadingPosition(one, 0.5)).toEqual({ ok: true });
    await Block.deleteMany({});

    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "Spam", by: erin, at: new Date() } },
    );
    signInAs(dave);
    expect(await saveReadingPosition(one, 0.5)).toEqual(NOT_FOUND);
    expect(await progressOf()).toEqual([]);
  });

  it("saves nothing for a guest or for wrong arguments", async () => {
    const [one] = (await seedBook()).chapters;
    signInAs(null);
    expect(await saveReadingPosition(one, 0.5)).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Signed out",
    });
    signInAs(dave);
    for (const position of [-0.1, 1.5, NaN, "0.5", null]) {
      expect(
        await saveReadingPosition(one, position as unknown as number),
      ).toEqual(INVALID);
    }
    expect(await saveReadingPosition({ $ne: null } as never, 0.5)).toEqual(
      INVALID,
    );
    expect(await ReadingProgress.countDocuments()).toBe(0);
  });

  it("limits saves per account", async () => {
    const [one] = (await seedBook()).chapters;
    for (let i = 0; i < 60; i++) {
      expect(await saveReadingPosition(one, i / 100)).toEqual({ ok: true });
    }
    expect(await saveReadingPosition(one, 0.9)).toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: en.errors.tooManyAttempts,
    });
  });
});

describe("new chapters", () => {
  it("count chapters published after the book was added until they are read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 1)));
    const book = await seedBook("Book", ["One", "Two", "Three"]);
    const [one, , three] = book.chapters;
    await Story.updateOne(
      { _id: three },
      { $set: { publication: "hidden" }, $unset: { publishedAt: 1 } },
    );
    expect((await addToLibrary(book.id, [])).ok).toBe(true);
    expect(await newCount(book)).toBe(0);

    vi.setSystemTime(new Date(Date.UTC(2026, 5, 2)));
    signInAs(alice);
    expect((await setChapterPublished(three, true)).ok).toBe(true);
    signInAs(dave);
    expect(await newCount(book)).toBe(1);

    // Reading an old chapter does not change the count; reading the new one does.
    await saveReadingPosition(one, 1);
    await saveReadingPosition(three, 0.5);
    expect(await newCount(book)).toBe(1);
    await saveReadingPosition(three, 1);
    expect(await newCount(book)).toBe(0);

    // Hiding a new chapter takes it out of the count.
    await ReadingProgress.updateMany({}, { $set: { readStoryIds: [] } });
    expect(await newCount(book)).toBe(1);
    signInAs(alice);
    await setChapterPublished(three, false);
    signInAs(dave);
    expect(await newCount(book)).toBe(0);
  });

  it("are marked on the contents page only for a book in the library", async () => {
    const book = await seedBook("Book", ["One", "Two"]);
    const [one, two] = book.chapters;
    await saveReadingPosition(one, 0.3);
    const { folderId, chapters } = (await publishedReaderChapters(
      "Alice",
      "book",
    ))!;
    expect(folderId).toBe(book.id);
    const outside = await folderReading(dave.toString(), folderId, chapters);
    expect(outside).toEqual({
      continueAt: { title: "One", path: "/p/Alice/book/one?continue=1" },
      newChapterIds: [],
    });

    await addToLibrary(book.id, []);
    await Story.updateOne(
      { _id: two },
      { publishedAt: new Date(Date.now() + DAY) },
    );
    const inside = await folderReading(
      dave.toString(),
      folderId,
      (await publishedReaderChapters("Alice", "book"))!.chapters,
    );
    expect(inside.newChapterIds).toEqual([two]);
  });

  it("Continue reading in the library leads to the last chapter while it is public", async () => {
    const book = await seedBook("Book", ["One", "Two"]);
    const [, two] = book.chapters;
    await saveReadingPosition(two, 0.6);
    const continueAt = async () =>
      (
        await libraryReading(dave.toString(), [
          { folderId: book.id, path: "/p/Alice/book" },
        ])
      ).get(book.id)!.continueAt;
    expect(await continueAt()).toEqual({
      title: "Two",
      path: "/p/Alice/book/two?continue=1",
    });
    await Story.updateOne({ _id: two }, { publication: "hidden" });
    expect(await continueAt()).toBeNull();
  });
});

describe("purgeSocialData", () => {
  it("deletes the progress of a purged folder and the purged chapters from the rest", async () => {
    const book = await seedBook("Book", ["One", "Two", "Three"]);
    const other = await seedBook("Other", ["Four"]);
    const [one, two, three] = book.chapters;
    await saveReadingPosition(one, 1);
    await saveReadingPosition(two, 1);
    await saveReadingPosition(three, 0.5);
    await saveReadingPosition(other.chapters[0], 0.5);

    await purgeSocialData({ folderIds: [], storyIds: [one, three] });
    expect(await progressOf()).toEqual(
      expect.arrayContaining([
        { folderId: book.folder, readStoryIds: [new Types.ObjectId(two)] },
      ]),
    );

    await purgeSocialData({ folderIds: [other.id], storyIds: [] });
    expect(await progressOf()).toEqual([
      { folderId: book.folder, readStoryIds: [new Types.ObjectId(two)] },
    ]);
  });
});
