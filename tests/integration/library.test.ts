import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToLibrary,
  createShelf,
  deleteShelf,
  removeFromLibrary,
  renameShelf,
  reorderShelves,
  setItemShelves,
  setLibraryPublic,
} from "@/app/[locale]/(protected)/library/actions";
import { seedShelves } from "@/app/[locale]/(protected)/library/starter";
import { requireUser } from "@/lib/auth/session";
import {
  ensureStarterShelves,
  isLibraryPublic,
  listLibraryBooks,
  listShelves,
} from "@/lib/library/queries";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import { LibraryItem } from "@/lib/models/library-item";
import { Profile } from "@/lib/models/profile";
import { Shelf } from "@/lib/models/shelf";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { getPublicLibrary, getPublicProfile } from "@/lib/profiles/queries";
import { purgeSocialData } from "@/lib/social/cascade";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const SHELF_NOT_FOUND = {
  ok: false,
  error: "NOT_FOUND",
  message: en.errors.shelfNotFound,
};
const BOOK_NOT_FOUND = {
  ok: false,
  error: "NOT_FOUND",
  message: en.errors.libraryBookNotFound,
};
const INVALID = {
  ok: false,
  error: "INVALID_INPUT",
  message: en.errors.requestInvalid,
};
const STARTER = Object.values(en.library.starter);

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;

// createdAt is immutable in Mongoose; an account older than a day gets the full limit (D80).
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

async function seedBook(name: string, userId = alice) {
  const folder = await Folder.create({ userId, name, published: true });
  const chapter = await Story.create({
    userId,
    folderId: folder._id,
    title: `${name} 1`,
    content: "text",
    publication: "public",
  });
  return {
    id: folder._id.toString(),
    folder: folder._id,
    chapter: chapter._id,
  };
}

async function shelfIds(userId = dave) {
  return (await listShelves(userId)).map(({ id }) => id);
}

async function seedFor(userId: Types.ObjectId) {
  signInAs(userId);
  await seedShelves(userId.toString());
  signInAs(dave);
  return shelfIds(userId);
}

const items = (userId = dave) =>
  LibraryItem.find({ userId }, { _id: 0, folderId: 1, shelfIds: 1 })
    .sort({ addedAt: 1 })
    .lean();

const bookNames = async (userId = dave, viewer: string | null = null) =>
  (await listLibraryBooks(userId, viewer ?? userId.toString())).map(
    ({ name }) => name,
  );

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  signInAs(dave);
});

describe("books in the library", () => {
  it("adds a book on several shelves, moves it and removes it", async () => {
    const book = await seedBook("Book");
    const [reading, later, read] = await seedFor(dave);

    expect(await addToLibrary(book.id, [reading, later])).toEqual({
      ok: true,
    });
    expect(await items()).toEqual([
      {
        folderId: book.folder,
        shelfIds: [new Types.ObjectId(reading), new Types.ObjectId(later)],
      },
    ]);
    expect(await setItemShelves(book.id, [read])).toEqual({ ok: true });
    expect((await items())[0].shelfIds.map(String)).toEqual([read]);
    expect(await setItemShelves(book.id, [])).toEqual({ ok: true });
    expect((await items())[0].shelfIds).toEqual([]);

    expect(await removeFromLibrary(book.id)).toEqual({ ok: true });
    expect(await items()).toEqual([]);
    expect(await removeFromLibrary(book.id)).toEqual(BOOK_NOT_FOUND);
    expect(await setItemShelves(book.id, [read])).toEqual(BOOK_NOT_FOUND);
  });

  it("keeps one item per book, also when two requests race", async () => {
    const book = await seedBook("Book");
    const [reading, later] = await seedFor(dave);
    await Promise.all([
      addToLibrary(book.id, [reading]),
      addToLibrary(book.id, [reading]),
      addToLibrary(book.id, []),
    ]);
    expect(await LibraryItem.countDocuments()).toBe(1);
    // Saving again only changes the shelves.
    const { addedAt } = (await LibraryItem.findOne().lean())!;
    expect(await addToLibrary(book.id, [later, later])).toEqual({ ok: true });
    const item = (await LibraryItem.findOne().lean())!;
    expect(item.shelfIds.map(String)).toEqual([later]);
    expect(item.addedAt).toEqual(addedAt);
    await expect(
      LibraryItem.create({
        userId: dave,
        folderId: book.folder,
        addedAt: new Date(),
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("lists the newest books first with author, address and 18+", async () => {
    const first = await seedBook("First");
    // Slugs come from every active folder of the author, as on the contents page.
    await Folder.create({ userId: erin, name: "Second?" });
    const second = await seedBook("Second!", erin);
    await Folder.updateOne({ _id: second.folder }, { adult: { manual: true } });
    await addToLibrary(first.id, []);
    await addToLibrary(second.id, []);
    const books = await listLibraryBooks(dave, dave.toString());
    expect(books).toEqual([
      expect.objectContaining({
        name: "Second!",
        nickname: "Erin",
        path: "/p/Erin/second-2",
        adult: true,
        cover: null,
        folderId: second.id,
      }),
      expect.objectContaining({
        name: "First",
        nickname: "Alice",
        path: "/p/Alice/first",
        adult: false,
      }),
    ]);
  });

  it("refuses bad input and a signed-out caller", async () => {
    const book = await seedBook("Book");
    expect(await addToLibrary("nope", [])).toEqual(INVALID);
    expect(await addToLibrary(book.id, "x" as unknown as string[])).toEqual(
      INVALID,
    );
    expect(await addToLibrary(book.id, [{}] as unknown as string[])).toEqual(
      INVALID,
    );
    expect(await setLibraryPublic("no" as unknown as boolean)).toEqual(INVALID);
    expect(await reorderShelves(["x"])).toEqual(INVALID);
    signInAs(null);
    expect(await addToLibrary(book.id, [])).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await createShelf("New")).toMatchObject({ error: "UNAUTHORIZED" });
    expect(await LibraryItem.countDocuments()).toBe(0);
  });

  it("limits library changes per account", async () => {
    const book = await seedBook("Book");
    await addToLibrary(book.id, []);
    for (let i = 1; i < 60; i++) {
      expect(await setItemShelves(book.id, [])).toEqual({ ok: true });
    }
    expect(await setItemShelves(book.id, [])).toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: en.errors.tooManyAttempts,
    });
  });

  it("allows at most 500 books per account", async () => {
    const kept = await seedBook("Kept");
    const extra = await seedBook("Extra");
    const [reading] = await seedFor(dave);
    expect(await addToLibrary(kept.id, [])).toEqual({ ok: true });
    await LibraryItem.insertMany(
      Array.from({ length: 499 }, (_, i) => ({
        userId: dave,
        folderId: new Types.ObjectId(),
        addedAt: new Date(Date.now() - i),
      })),
    );

    expect(await addToLibrary(extra.id, [])).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message:
        "You can have at most 500 books in your library. Remove a book to add a new one.",
    });
    expect(await addToLibrary(kept.id, [reading])).toEqual({ ok: true });
    expect(await LibraryItem.countDocuments({ userId: dave })).toBe(500);

    signInAs(erin);
    expect(await addToLibrary(extra.id, [])).toEqual({ ok: true });
  });
});

describe("shelves", () => {
  it("creates the starter shelves once, also when requests race", async () => {
    await Promise.all([
      ensureStarterShelves(dave.toString(), STARTER),
      ensureStarterShelves(dave.toString(), STARTER),
      ensureStarterShelves(dave.toString(), STARTER),
    ]);
    expect((await listShelves(dave)).map(({ name }) => name)).toEqual([
      "Reading",
      "Read later",
      "Read",
    ]);
    expect(
      (await Profile.findOne({ userId: dave }).lean())?.shelvesSeededAt,
    ).toBeInstanceOf(Date);

    // Deleted starter shelves do not come back.
    for (const id of await shelfIds()) await deleteShelf(id);
    await seedShelves(dave.toString());
    expect(await Shelf.countDocuments({ userId: dave })).toBe(0);
  });

  it("seeds an existing profile and keeps its fields", async () => {
    await Profile.create({ userId: dave, bio: "Hi", libraryPublic: false });
    await seedShelves(dave.toString());
    expect(await Shelf.countDocuments({ userId: dave })).toBe(3);
    expect(await Profile.findOne({ userId: dave }).lean()).toMatchObject({
      bio: "Hi",
      libraryPublic: false,
    });
  });

  it("renames, deletes, creates and reorders shelves, starter ones too", async () => {
    const [reading, later, read] = await seedFor(dave);
    expect(await renameShelf(reading, "  Now  ")).toEqual({ ok: true });
    expect(await deleteShelf(later)).toEqual({ ok: true });
    const created = await createShelf("Favourites");
    expect(created).toEqual({
      ok: true,
      shelf: { id: expect.any(String), name: "Favourites" },
    });
    const favourites = created.ok ? created.shelf.id : "";
    expect((await listShelves(dave)).map(({ name }) => name)).toEqual([
      "Now",
      "Read",
      "Favourites",
    ]);

    expect(await reorderShelves([favourites, reading, read])).toEqual({
      ok: true,
    });
    expect(await shelfIds()).toEqual([favourites, reading, read]);
    // A stale list (a shelf missing or repeated) changes nothing.
    const conflict = {
      ok: false,
      error: "CONFLICT",
      message: en.errors.requestInvalid,
    };
    expect(await reorderShelves([reading, read])).toEqual(conflict);
    expect(await reorderShelves([reading, read, read])).toEqual(conflict);
    expect(await shelfIds()).toEqual([favourites, reading, read]);
  });

  it("checks shelf names", async () => {
    await seedFor(dave);
    expect(await createShelf("   ")).toEqual({
      ok: false,
      error: "EMPTY_NAME",
      message: en.errors.shelfNameRequired,
    });
    expect(await createShelf("a".repeat(51))).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: "A shelf name can have at most 50 characters.",
    });
    expect((await createShelf("a".repeat(50))).ok).toBe(true);
    const [first] = await shelfIds();
    expect(await renameShelf(first, "")).toMatchObject({ error: "EMPTY_NAME" });
    expect(await renameShelf(first, 5 as unknown as string)).toEqual(INVALID);
  });

  it("allows at most 20 shelves, the starter ones included", async () => {
    for (let i = 0; i < 17; i++) {
      expect((await createShelf(`Shelf ${i}`)).ok).toBe(true);
    }
    expect(await Shelf.countDocuments({ userId: dave })).toBe(20);
    expect(await createShelf("One more")).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message:
        "You can have at most 20 shelves. Delete a shelf to add a new one.",
    });
    expect(await Shelf.countDocuments({ userId: dave })).toBe(20);
  });

  it("keeps the books of a deleted shelf in the library", async () => {
    const one = await seedBook("One");
    const two = await seedBook("Two");
    const [reading, later] = await seedFor(dave);
    await addToLibrary(one.id, [reading]);
    await addToLibrary(two.id, [reading, later]);

    expect(await deleteShelf(reading)).toEqual({ ok: true });
    expect((await items()).map(({ shelfIds }) => shelfIds.map(String))).toEqual(
      [[], [later]],
    );
    expect(await bookNames()).toEqual(["Two", "One"]);
    expect(await deleteShelf(reading)).toEqual(SHELF_NOT_FOUND);
  });
});

describe("isolation", () => {
  it("treats another account's shelves as missing", async () => {
    const book = await seedBook("Book");
    const [erinShelf] = await seedFor(erin);
    const [own] = await seedFor(dave);
    await addToLibrary(book.id, [own]);

    expect(await renameShelf(erinShelf, "Mine")).toEqual(SHELF_NOT_FOUND);
    expect(await deleteShelf(erinShelf)).toEqual(SHELF_NOT_FOUND);
    expect(await addToLibrary(book.id, [own, erinShelf])).toEqual(
      SHELF_NOT_FOUND,
    );
    expect(await setItemShelves(book.id, [erinShelf])).toEqual(SHELF_NOT_FOUND);
    expect(await reorderShelves([...(await shelfIds()), erinShelf])).toEqual(
      SHELF_NOT_FOUND,
    );
    expect((await listShelves(erin)).map(({ name }) => name)).toEqual(STARTER);
    expect((await items())[0].shelfIds.map(String)).toEqual([own]);
  });

  it("treats another account's library items as missing", async () => {
    const book = await seedBook("Book");
    const [erinShelf] = await seedFor(erin);
    signInAs(erin);
    await addToLibrary(book.id, [erinShelf]);
    signInAs(dave);

    expect(await removeFromLibrary(book.id)).toEqual(BOOK_NOT_FOUND);
    expect(await setItemShelves(book.id, [])).toEqual(BOOK_NOT_FOUND);
    expect(
      (await items(erin)).map(({ shelfIds }) => shelfIds.map(String)),
    ).toEqual([[erinShelf]]);
    expect(await bookNames(dave)).toEqual([]);
  });
});

describe("visibility", () => {
  it("adds only books readers can see", async () => {
    const draft = await Folder.create({ userId: alice, name: "Draft" });
    const hidden = await seedBook("Hidden");
    await Story.updateOne({ _id: hidden.chapter }, { publication: "hidden" });
    const deleted = await seedBook("Deleted");
    await Folder.updateOne({ _id: deleted.folder }, { deletedAt: new Date() });
    for (const id of [
      draft._id.toString(),
      hidden.id,
      deleted.id,
      new Types.ObjectId().toString(),
    ]) {
      expect(await addToLibrary(id, [])).toEqual(BOOK_NOT_FOUND);
    }
    expect(await LibraryItem.countDocuments()).toBe(0);
  });

  it("hides a book while it is not public and shows it again after", async () => {
    const book = await seedBook("Book");
    await addToLibrary(book.id, []);
    expect(await bookNames()).toEqual(["Book"]);

    await Folder.updateOne({ _id: book.folder }, { published: false });
    expect(await bookNames()).toEqual([]);
    await Folder.updateOne({ _id: book.folder }, { published: true });
    expect(await bookNames()).toEqual(["Book"]);

    await Story.updateOne({ _id: book.chapter }, { publication: "hidden" });
    expect(await bookNames()).toEqual([]);
    await Story.updateOne({ _id: book.chapter }, { publication: "public" });

    await Folder.updateOne({ _id: book.folder }, { deletedAt: new Date() });
    expect(await bookNames()).toEqual([]);
    await Folder.updateOne({ _id: book.folder }, { deletedAt: null });
    expect(await bookNames()).toEqual(["Book"]);
    // The item itself stays all along, shelves included.
    expect(await LibraryItem.countDocuments()).toBe(1);
  });

  it("hides books of globally banned authors and of authors the viewer blocked", async () => {
    const book = await seedBook("Book");
    await addToLibrary(book.id, []);
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await bookNames()).toEqual([]);
    expect(await bookNames(dave, erin.toString())).toEqual(["Book"]);
    await Block.deleteMany({});

    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "Spam", by: erin, at: new Date() } },
    );
    expect(await bookNames()).toEqual([]);
    expect(await addToLibrary(book.id, [])).toEqual(BOOK_NOT_FOUND);
  });
});

describe("public library on the profile", () => {
  it("shows the shelves with public books and hides a private library", async () => {
    const one = await seedBook("One");
    const two = await seedBook("Two");
    const gone = await seedBook("Gone");
    const [reading, later] = await seedFor(dave);
    await addToLibrary(one.id, [reading]);
    await addToLibrary(two.id, []);
    await addToLibrary(gone.id, [later]);
    await Folder.updateOne({ _id: gone.folder }, { published: false });

    for (const viewer of [null, erin.toString(), dave.toString()]) {
      expect(await getPublicLibrary(dave, viewer)).toEqual({
        shelves: [
          expect.objectContaining({
            name: "Reading",
            books: [expect.objectContaining({ name: "One" })],
          }),
        ],
        other: [expect.objectContaining({ name: "Two" })],
      });
    }

    expect(await isLibraryPublic(dave)).toBe(true);
    expect(await setLibraryPublic(false)).toEqual({
      ok: true,
      libraryPublic: false,
    });
    expect(await isLibraryPublic(dave)).toBe(false);
    for (const viewer of [null, erin.toString(), dave.toString()]) {
      expect((await getPublicProfile("Dave", viewer))?.libraryPublic).toBe(
        false,
      );
    }
    expect(await setLibraryPublic(true)).toEqual({
      ok: true,
      libraryPublic: true,
    });
    expect((await getPublicProfile("Dave", null))?.libraryPublic).toBe(true);
  });

  it("switches privacy without a profile, keeping the other fields", async () => {
    signInAs(erin);
    expect((await setLibraryPublic(false)).ok).toBe(true);
    expect(await Profile.findOne({ userId: erin }).lean()).toMatchObject({
      bio: "",
      libraryPublic: false,
    });
  });
});

describe("purgeSocialData", () => {
  it("deletes the library items of a purged folder only", async () => {
    const one = await seedBook("One");
    const two = await seedBook("Two");
    await addToLibrary(one.id, []);
    await addToLibrary(two.id, []);
    signInAs(erin);
    await addToLibrary(one.id, []);

    // A purged chapter leaves the book in libraries.
    await purgeSocialData({
      folderIds: [],
      storyIds: [one.chapter.toString()],
    });
    expect(await LibraryItem.countDocuments()).toBe(3);

    await purgeSocialData({ folderIds: [one.id], storyIds: [] });
    expect(
      (await LibraryItem.find().lean()).map(({ folderId }) =>
        folderId.toString(),
      ),
    ).toEqual([two.id]);
  });
});
