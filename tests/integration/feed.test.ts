import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAllChapters,
  setFolderPublished,
} from "@/app/[locale]/(protected)/folders/actions";
import {
  deleteStory,
  setChapterPublished,
} from "@/app/[locale]/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { Activity, ACTIVITY_TTL_DAYS } from "@/lib/models/activity";
import { Block } from "@/lib/models/block";
import { Follow } from "@/lib/models/follow";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { stampPublishedAt } from "@/lib/publish/mutations";
import { purgeSocialData } from "@/lib/social/cascade";
import { FEED_PAGE_SIZE, getFeed, parseFeedCursor } from "@/lib/social/feed";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;

async function createUser(nickname: string) {
  return (await User.create({ nickname, passwordHash: "x" }))._id;
}

function signInAs(userId: Types.ObjectId) {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: userId.toString(),
  });
}

async function seedBook(owner = alice, titles = ["One", "Two"], name = "Book") {
  const folder = await Folder.create({ userId: owner, name });
  const ids: string[] = [];
  for (const title of titles) {
    const { _id } = await Story.create({
      userId: owner,
      folderId: folder._id,
      title,
    });
    ids.push(_id.toString());
  }
  return { folderId: folder._id.toString(), ids };
}

async function feedOf(user: Types.ObjectId, after: string | null = null) {
  return getFeed(user.toString(), parseFeedCursor(after));
}

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  await Follow.create({ followerId: dave, followeeId: alice });
  signInAs(alice);
});

describe("recording", () => {
  it("records one entry per published chapter, only on its first publication", async () => {
    const book = await seedBook();
    expect(await setChapterPublished(book.ids[0], true)).toMatchObject({
      ok: true,
    });
    await setChapterPublished(book.ids[0], false);
    await setChapterPublished(book.ids[0], true);
    const entries = await Activity.find().lean();
    expect(entries).toEqual([
      expect.objectContaining({
        actorId: alice,
        type: "chapterPublished",
        folderId: new Types.ObjectId(book.folderId),
        storyIds: [new Types.ObjectId(book.ids[0])],
      }),
    ]);
  });

  it("records one entry per book when a folder publishes many chapters", async () => {
    const book = await seedBook(alice, ["One", "Two", "Three"]);
    expect(await setFolderPublished(book.folderId, true)).toEqual({ ok: true });
    expect(await Activity.countDocuments()).toBe(1);
    const [entry] = (await feedOf(dave)).entries;
    expect(entry.chapters).toHaveLength(3);

    await setFolderPublished(book.folderId, false);
    await setFolderPublished(book.folderId, true);
    await publishAllChapters(book.folderId);
    expect(await Activity.countDocuments()).toBe(1);
  });

  it("stampPublishedAt returns only the chapters it dated", async () => {
    const book = await seedBook();
    await Story.updateMany({}, { $set: { publication: "public" } });
    await Story.updateOne(
      { _id: book.ids[1] },
      { $set: { publishedAt: new Date("2026-01-01") } },
    );
    const stamped = await stampPublishedAt({ folderId: book.folderId });
    expect(stamped.map(String)).toEqual([book.ids[0]]);
    expect(await stampPublishedAt({ folderId: book.folderId })).toEqual([]);
  });

  it("concurrent publications date each chapter once and record it once", async () => {
    const book = await seedBook(alice, ["One", "Two", "Three"]);
    await Story.updateMany({}, { $set: { publication: "public" } });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        stampPublishedAt({ folderId: book.folderId }),
      ),
    );
    expect(results.flat().map(String).toSorted()).toEqual(book.ids.toSorted());

    const other = await seedBook(alice, ["Four"], "Other");
    await Promise.all([
      setChapterPublished(other.ids[0], true),
      setChapterPublished(other.ids[0], true),
    ]);
    expect(await Activity.countDocuments({ folderId: other.folderId })).toBe(1);
  });

  it("keeps entries for 90 days by a TTL index", async () => {
    const indexes = await Activity.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: { createdAt: 1 },
        expireAfterSeconds: ACTIVITY_TTL_DAYS * 24 * 60 * 60,
      }),
    );
    expect(ACTIVITY_TTL_DAYS).toBe(90);
  });
});

describe("feed", () => {
  it("shows a followed author's publication to followers only (criterion 1)", async () => {
    const book = await seedBook();
    await setChapterPublished(book.ids[0], true);
    const feed = await feedOf(dave);
    expect(feed).toEqual({
      next: null,
      entries: [
        expect.objectContaining({
          nickname: "Alice",
          book: expect.objectContaining({
            name: "Book",
            path: "/p/Alice/book",
          }),
          chapters: [{ title: "One", path: "/p/Alice/book/one" }],
        }),
      ],
    });
    expect((await feedOf(erin)).entries).toEqual([]);
    expect((await feedOf(alice)).entries).toEqual([]);
  });

  it("marks 18+ books and chapters", async () => {
    const book = await seedBook();
    await Story.updateOne(
      { _id: book.ids[0] },
      { $set: { adult: { manual: true } } },
    );
    await setChapterPublished(book.ids[0], true);
    expect((await feedOf(dave)).entries[0].book.adult).toBe(true);
  });

  it("drops hidden or deleted chapters at read time and does not repeat them (criterion 2)", async () => {
    const book = await seedBook();
    await setChapterPublished(book.ids[0], true);
    await setChapterPublished(book.ids[0], false);
    expect((await feedOf(dave)).entries).toEqual([]);
    await setChapterPublished(book.ids[0], true);
    expect((await feedOf(dave)).entries).toHaveLength(1);
    expect(await Activity.countDocuments()).toBe(1);

    expect(await deleteStory(book.ids[0])).toEqual({ ok: true });
    expect((await feedOf(dave)).entries).toEqual([]);
  });

  it("counts only the chapters of a publication still public", async () => {
    const book = await seedBook(alice, ["One", "Two", "Three"]);
    await setFolderPublished(book.folderId, true);
    await setChapterPublished(book.ids[1], false);
    const [entry] = (await feedOf(dave)).entries;
    expect(entry.chapters.map(({ title }) => title)).toEqual(["One", "Three"]);

    await setFolderPublished(book.folderId, false);
    expect((await feedOf(dave)).entries).toEqual([]);
  });

  it("hard deletion of a chapter or a folder deletes its entries", async () => {
    const first = await seedBook(alice, ["One", "Two"], "First");
    const second = await seedBook(alice, ["Three"], "Second");
    await setFolderPublished(first.folderId, true);
    await setChapterPublished(second.ids[0], true);
    await purgeSocialData({ folderIds: [], storyIds: [first.ids[0]] });
    const kept = await Activity.findOne({ folderId: first.folderId }).lean();
    expect(kept!.storyIds).toEqual([new Types.ObjectId(first.ids[1])]);
    await purgeSocialData({ folderIds: [], storyIds: [first.ids[1]] });
    expect(await Activity.countDocuments({ folderId: first.folderId })).toBe(0);
    await purgeSocialData({ folderIds: [second.folderId], storyIds: [] });
    expect(await Activity.countDocuments()).toBe(0);
  });

  describe("hidden authors (criterion 3)", () => {
    beforeEach(async () => {
      const book = await seedBook();
      await setChapterPublished(book.ids[0], true);
      expect((await feedOf(dave)).entries).toHaveLength(1);
    });

    it("leaves out an author the viewer blocked", async () => {
      await Block.create({ blockerId: dave, blockedId: alice });
      expect((await feedOf(dave)).entries).toEqual([]);
    });

    it("leaves out an author who blocked the viewer", async () => {
      await Block.create({ blockerId: alice, blockedId: dave });
      expect((await feedOf(dave)).entries).toEqual([]);
    });

    it("leaves out a globally banned author, and shows them again after the ban", async () => {
      await User.updateOne(
        { _id: alice },
        {
          $set: {
            globalBan: {
              until: null,
              reason: "Spam",
              by: erin,
              at: new Date(),
            },
          },
        },
      );
      expect((await feedOf(dave)).entries).toEqual([]);
      await User.updateOne(
        { _id: alice },
        { $set: { "globalBan.until": new Date(Date.now() - 1000) } },
      );
      expect((await feedOf(dave)).entries).toHaveLength(1);
    });

    it("stops after unfollowing", async () => {
      await Follow.deleteMany({});
      expect((await feedOf(dave)).entries).toEqual([]);
    });
  });

  it("pages by 30 without repeating entries of the same date (criterion 4)", async () => {
    const book = await seedBook(alice, ["One"]);
    await setChapterPublished(book.ids[0], true);
    const [template] = await Activity.find().lean();
    await Activity.deleteMany({});
    const createdAt = new Date("2026-11-01T12:00:00.000Z");
    const total = FEED_PAGE_SIZE + 5;
    await Activity.collection.insertMany(
      Array.from({ length: total }, () => ({
        actorId: template.actorId,
        type: "chapterPublished",
        folderId: template.folderId,
        storyIds: template.storyIds,
        createdAt,
      })),
    );
    // Entries hidden at read time are skipped without shortening the page.
    await Activity.collection.insertMany(
      Array.from({ length: 70 }, () => ({
        actorId: alice,
        type: "chapterPublished",
        folderId: new Types.ObjectId(),
        storyIds: [new Types.ObjectId()],
        createdAt,
      })),
    );
    const first = await feedOf(dave);
    expect(first.entries).toHaveLength(FEED_PAGE_SIZE);
    expect(first.next).not.toBeNull();
    const second = await feedOf(dave, first.next);
    expect(second.entries).toHaveLength(5);
    expect(second.next).toBeNull();
    const ids = [...first.entries, ...second.entries].map(({ id }) => id);
    expect(new Set(ids).size).toBe(total);
  });

  it("orders entries from the newest", async () => {
    const first = await seedBook(alice, ["One"], "First");
    const second = await seedBook(alice, ["Two"], "Second");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    await setChapterPublished(first.ids[0], true);
    vi.setSystemTime(new Date("2026-11-01T11:00:00Z"));
    await setChapterPublished(second.ids[0], true);
    vi.useRealTimers();
    expect((await feedOf(dave)).entries.map(({ book }) => book.name)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("ignores a malformed cursor", () => {
    expect(parseFeedCursor("x_y")).toBeNull();
    expect(parseFeedCursor(["1_000000000000000000000000"])).toBeNull();
  });
});
