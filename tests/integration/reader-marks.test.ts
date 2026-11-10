import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBookmark,
  addNote,
  deleteReaderMark,
  updateReaderMark,
  type NoteInput,
} from "@/app/[locale]/p/[nickname]/[folder]/[chapter]/actions";
import { requireUser } from "@/lib/auth/session";
import {
  MAX_BOOKMARK_NAME_LENGTH,
  MAX_MARKS_PER_ACCOUNT,
  MAX_MARKS_PER_CHAPTER,
  MAX_QUOTE_CONTEXT_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_READER_NOTE_LENGTH,
} from "@/lib/limits";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import { ReaderMark } from "@/lib/models/reader-mark";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { listChapterMarks } from "@/lib/reading/marks";
import { libraryReading } from "@/lib/reading/queries";
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
const MARK_NOT_FOUND = {
  ok: false,
  error: "NOT_FOUND",
  message: en.errors.readerMarkNotFound,
};
const INVALID = {
  ok: false,
  error: "INVALID_INPUT",
  message: en.errors.requestInvalid,
};

const limitError = (key: keyof typeof en.errors, max: number) => ({
  ok: false,
  error: "INVALID_INPUT",
  message: en.errors[key].replace("{max, number}", max.toLocaleString("en")),
});

const NOTE: NoteInput = {
  quote: "waited by the door",
  prefix: "The keeper ",
  suffix: ", listening.",
  position: 0.2,
  text: "Lovely line",
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
  const folder = await Folder.create({ userId: alice, name, published: true });
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

// Count limits are tested with stored marks, not thousands of calls.
async function seedMarks(
  userId: Types.ObjectId,
  storyId: string,
  folderId: Types.ObjectId,
  count: number,
) {
  const now = new Date();
  await ReaderMark.collection.insertMany(
    Array.from({ length: count }, () => ({
      userId,
      storyId: new Types.ObjectId(storyId),
      folderId,
      kind: "bookmark",
      position: 0.5,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  signInAs(dave);
});

describe("addBookmark and addNote", () => {
  it("save a bookmark and a note of the reader in the chapter", async () => {
    const book = await seedBook();
    const [one] = book.chapters;
    const bookmark = await addBookmark(one, 0.45, "  Middle  ");
    expect(bookmark).toEqual({
      ok: true,
      mark: expect.objectContaining({
        kind: "bookmark",
        position: 0.45,
        name: "Middle",
        text: "",
        quote: "",
      }),
    });
    const note = await addNote(one, { ...NOTE, text: "  Lovely line  " });
    expect(note).toEqual({
      ok: true,
      mark: expect.objectContaining({
        kind: "note",
        position: 0.2,
        quote: NOTE.quote,
        prefix: NOTE.prefix,
        suffix: NOTE.suffix,
        text: "Lovely line",
      }),
    });
    const stored = await ReaderMark.find().lean();
    expect(stored.map(({ folderId }) => folderId)).toEqual([
      book.folder,
      book.folder,
    ]);
    expect(
      (await listChapterMarks(dave.toString(), one)).map(({ kind }) => kind),
    ).toEqual(["note", "bookmark"]);
    // A bookmark name and a note text are optional.
    expect((await addBookmark(one, 0, "")).ok).toBe(true);
    expect((await addNote(one, { ...NOTE, text: " " })).ok).toBe(true);
  });

  it("let the author mark their own chapter", async () => {
    const [one] = (await seedBook()).chapters;
    signInAs(alice);
    expect((await addBookmark(one, 0.1, "Mine")).ok).toBe(true);
  });

  it("give NOT_FOUND for a chapter that is not public, deleted or missing", async () => {
    const book = await seedBook("Book", ["One", "Hidden", "Deleted"]);
    const [one, hidden, deleted] = book.chapters;
    await Story.updateOne({ _id: hidden }, { publication: "hidden" });
    await Story.updateOne({ _id: deleted }, { deletedAt: new Date() });
    for (const id of [hidden, deleted, new Types.ObjectId().toString()]) {
      expect(await addBookmark(id, 0.5, "")).toEqual(NOT_FOUND);
      expect(await addNote(id, NOTE)).toEqual(NOT_FOUND);
    }
    await Folder.updateOne({ _id: book.folder }, { published: false });
    expect(await addBookmark(one, 0.5, "")).toEqual(NOT_FOUND);
    await Folder.updateOne(
      { _id: book.folder },
      { published: true, deletedAt: new Date() },
    );
    expect(await addNote(one, NOTE)).toEqual(NOT_FOUND);
    expect(await ReaderMark.countDocuments()).toBe(0);
  });

  it("give NOT_FOUND for a book of a blocked or globally banned author", async () => {
    const [one] = (await seedBook()).chapters;
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await addBookmark(one, 0.5, "")).toEqual(NOT_FOUND);
    signInAs(erin);
    expect((await addBookmark(one, 0.5, "")).ok).toBe(true);
    await Block.deleteMany({});
    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "Spam", by: erin, at: new Date() } },
    );
    signInAs(dave);
    expect(await addNote(one, NOTE)).toEqual(NOT_FOUND);
    expect(await ReaderMark.countDocuments({ userId: dave })).toBe(0);
  });

  it("save nothing for a guest or for wrong arguments", async () => {
    const [one] = (await seedBook()).chapters;
    signInAs(null);
    const signedOut = {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Signed out",
    };
    expect(await addBookmark(one, 0.5, "")).toEqual(signedOut);
    expect(await addNote(one, NOTE)).toEqual(signedOut);
    signInAs(dave);
    for (const position of [-0.1, 1.5, NaN, "0.5", null]) {
      expect(await addBookmark(one, position as never, "")).toEqual(INVALID);
      expect(
        await addNote(one, { ...NOTE, position: position as never }),
      ).toEqual(INVALID);
    }
    expect(await addBookmark(one, 0.5, null as never)).toEqual(INVALID);
    expect(await addBookmark({ $ne: null } as never, 0.5, "")).toEqual(INVALID);
    for (const input of [
      null,
      "note",
      { ...NOTE, quote: "   " },
      { ...NOTE, quote: 1 },
      { ...NOTE, prefix: undefined },
      { ...NOTE, text: null },
    ]) {
      expect(await addNote(one, input as never)).toEqual(INVALID);
    }
    expect(await ReaderMark.countDocuments()).toBe(0);
  });
});

describe("limits", () => {
  it("reject texts longer than the limits with a message", async () => {
    const [one] = (await seedBook()).chapters;
    expect(
      await addBookmark(one, 0.5, "x".repeat(MAX_BOOKMARK_NAME_LENGTH + 1)),
    ).toEqual(limitError("bookmarkNameTooLong", MAX_BOOKMARK_NAME_LENGTH));
    expect(
      await addNote(one, {
        ...NOTE,
        text: "x".repeat(MAX_READER_NOTE_LENGTH + 1),
      }),
    ).toEqual(limitError("readerNoteTooLong", MAX_READER_NOTE_LENGTH));
    expect(
      await addNote(one, { ...NOTE, quote: "x".repeat(MAX_QUOTE_LENGTH + 1) }),
    ).toEqual(limitError("quoteTooLong", MAX_QUOTE_LENGTH));
    for (const context of ["prefix", "suffix"]) {
      expect(
        await addNote(one, {
          ...NOTE,
          [context]: "x".repeat(MAX_QUOTE_CONTEXT_LENGTH + 1),
        }),
      ).toEqual(limitError("quoteContextTooLong", MAX_QUOTE_CONTEXT_LENGTH));
    }
    // At the limit is fine.
    expect(
      (
        await addNote(one, {
          quote: "x".repeat(MAX_QUOTE_LENGTH),
          prefix: "p".repeat(MAX_QUOTE_CONTEXT_LENGTH),
          suffix: "s".repeat(MAX_QUOTE_CONTEXT_LENGTH),
          position: 1,
          text: "t".repeat(MAX_READER_NOTE_LENGTH),
        })
      ).ok,
    ).toBe(true);

    const { mark } = (await addBookmark(one, 0.5, "Short")) as {
      mark: { id: string };
    };
    expect(
      await updateReaderMark(mark.id, "x".repeat(MAX_BOOKMARK_NAME_LENGTH + 1)),
    ).toEqual(limitError("bookmarkNameTooLong", MAX_BOOKMARK_NAME_LENGTH));
  });

  it(`allow ${MAX_MARKS_PER_CHAPTER} marks in a chapter`, async () => {
    const book = await seedBook();
    const [one, two] = book.chapters;
    await seedMarks(dave, one, book.folder, MAX_MARKS_PER_CHAPTER - 1);
    expect((await addNote(one, NOTE)).ok).toBe(true);
    const full = limitError("tooManyChapterMarks", MAX_MARKS_PER_CHAPTER);
    expect(await addBookmark(one, 0.5, "")).toEqual(full);
    expect(await addNote(one, NOTE)).toEqual(full);
    // Another chapter and another reader have their own room.
    expect((await addBookmark(two, 0.5, "")).ok).toBe(true);
    signInAs(erin);
    expect((await addBookmark(one, 0.5, "")).ok).toBe(true);
  });

  it(`allow ${MAX_MARKS_PER_ACCOUNT} marks in an account`, async () => {
    const book = await seedBook();
    const other = await seedBook("Other", ["Three"]);
    const [one] = book.chapters;
    await seedMarks(dave, one, book.folder, MAX_MARKS_PER_ACCOUNT - 1);
    expect((await addBookmark(other.chapters[0], 0.5, "")).ok).toBe(true);
    expect(await addNote(other.chapters[0], NOTE)).toEqual(
      limitError("tooManyMarks", MAX_MARKS_PER_ACCOUNT),
    );
  });

  it("limit changes per account", async () => {
    const [one] = (await seedBook()).chapters;
    const { mark } = (await addBookmark(one, 0.5, "")) as {
      mark: { id: string };
    };
    for (let i = 1; i < 60; i++) {
      expect((await updateReaderMark(mark.id, `Name ${i}`)).ok).toBe(true);
    }
    const limited = {
      ok: false,
      error: "RATE_LIMITED",
      message: en.errors.tooManyAttempts,
    };
    expect(await addBookmark(one, 0.5, "")).toEqual(limited);
    expect(await deleteReaderMark(mark.id)).toEqual(limited);
  });
});

describe("privacy", () => {
  it("only the owner lists, edits and deletes their marks", async () => {
    const book = await seedBook();
    const [one] = book.chapters;
    const note = (await addNote(one, NOTE)) as { mark: { id: string } };
    const bookmark = (await addBookmark(one, 0.4, "Mine")) as {
      mark: { id: string };
    };

    // Neither another reader nor the chapter's author sees them (D1).
    for (const other of [erin, alice]) {
      expect(await listChapterMarks(other.toString(), one)).toEqual([]);
      const library = await libraryReading(other.toString(), [
        { folderId: book.id, path: "/p/Alice/book" },
      ]);
      expect(library.get(book.id)!.marks).toEqual([]);
      signInAs(other);
      expect(await updateReaderMark(note.mark.id, "Changed")).toEqual(
        MARK_NOT_FOUND,
      );
      expect(await deleteReaderMark(bookmark.mark.id)).toEqual(MARK_NOT_FOUND);
    }
    expect(await ReaderMark.countDocuments({ userId: dave })).toBe(2);

    signInAs(dave);
    expect(await updateReaderMark(note.mark.id, " Changed ")).toEqual({
      ok: true,
      mark: expect.objectContaining({ kind: "note", text: "Changed" }),
    });
    expect(await updateReaderMark(bookmark.mark.id, "")).toEqual({
      ok: true,
      mark: expect.objectContaining({ kind: "bookmark", name: "" }),
    });
    expect(await deleteReaderMark(bookmark.mark.id)).toEqual({ ok: true });
    expect(await deleteReaderMark(bookmark.mark.id)).toEqual(MARK_NOT_FOUND);
    expect(
      (await listChapterMarks(dave.toString(), one)).map(({ id }) => id),
    ).toEqual([note.mark.id]);
  });

  it("the library lists the reader's marks in chapters that are still public", async () => {
    const book = await seedBook();
    const [one, two] = book.chapters;
    const note = (await addNote(one, NOTE)) as { mark: { id: string } };
    await addBookmark(two, 0.4, "");
    const marks = async () =>
      (
        await libraryReading(dave.toString(), [
          { folderId: book.id, path: "/p/Alice/book" },
        ])
      ).get(book.id)!.marks;
    expect(await marks()).toEqual([
      expect.objectContaining({
        kind: "bookmark",
        label: "",
        chapter: "Two",
        position: 0.4,
      }),
      {
        id: note.mark.id,
        kind: "note",
        label: NOTE.quote,
        position: NOTE.position,
        chapter: "One",
        path: `/p/Alice/book/one?mark=${note.mark.id}`,
      },
    ]);
    await Story.updateOne({ _id: two }, { publication: "hidden" });
    expect((await marks()).map(({ id }) => id)).toEqual([note.mark.id]);
  });
});

describe("purgeSocialData", () => {
  it("deletes the marks of a purged chapter and of a purged folder", async () => {
    const book = await seedBook();
    const other = await seedBook("Other", ["Three"]);
    const [one, two] = book.chapters;
    await addNote(one, NOTE);
    await addBookmark(two, 0.5, "");
    await addBookmark(other.chapters[0], 0.5, "");
    signInAs(erin);
    await addBookmark(one, 0.5, "");

    await purgeSocialData({ folderIds: [], storyIds: [one] });
    expect(
      (await ReaderMark.find().lean()).map(({ storyId }) => String(storyId)),
    ).toEqual(expect.arrayContaining([two, other.chapters[0]]));
    expect(await ReaderMark.countDocuments()).toBe(2);

    await purgeSocialData({ folderIds: [other.id], storyIds: [] });
    expect(
      (await ReaderMark.find().lean()).map(({ storyId }) => String(storyId)),
    ).toEqual([two]);
  });
});
