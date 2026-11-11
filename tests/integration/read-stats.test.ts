import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveStory } from "@/app/[locale]/(protected)/stories/actions";
import { requireUser } from "@/lib/auth/session";
import { Comment } from "@/lib/models/comment";
import { DailyStat } from "@/lib/models/daily-stat";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { LibraryItem } from "@/lib/models/library-item";
import { Rating } from "@/lib/models/rating";
import { Reaction } from "@/lib/models/reaction";
import { ReadEvent } from "@/lib/models/read-event";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { getAuthorStats, hasPublication } from "@/lib/social/author-stats";
import { purgeSocialData } from "@/lib/social/cascade";
import {
  chapterReader,
  type ChapterRead,
  readerKey,
  recordRead,
} from "@/lib/social/read-stats";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const IP_HEADER = "x-test-client-ip";
const IP = "203.0.113.7";

let alice: Types.ObjectId;
let bob: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
  });
  return insertedId;
}

async function seedBook(userId: Types.ObjectId, name = "Book") {
  const folder = await Folder.create({ userId, name, published: true });
  const chapter = await Story.create({
    userId,
    folderId: folder._id,
    title: `${name} one`,
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id.toString(), storyId: chapter._id.toString() };
}

const readOf = (reader: string, place = book): ChapterRead => ({
  ...place,
  authorId: alice.toString(),
  reader,
});

const readers = async (storyId = book.storyId) =>
  (await DailyStat.find({ storyId }).sort({ day: 1 }).lean()).map(
    ({ day, readers }) => ({ day, readers }),
  );

const withIp = (ip?: string) => new Headers(ip ? { [IP_HEADER]: ip } : {});

beforeEach(async () => {
  vi.stubEnv("TRUSTED_IP_HEADER", IP_HEADER);
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  book = await seedBook(alice);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("unique readers per day (criterion 1)", () => {
  it("counts the same reader once a day and again the next day", async () => {
    vi.useFakeTimers({
      now: new Date("2026-11-10T23:00:00Z"),
      toFake: ["Date"],
    });
    const reader = `u:${dave}`;
    await recordRead(readOf(reader));
    await recordRead(readOf(reader));
    await recordRead(readOf(`u:${erin}`));
    expect(await readers()).toEqual([{ day: "2026-11-10", readers: 2 }]);
    vi.setSystemTime(new Date("2026-11-11T00:30:00Z"));
    await recordRead(readOf(reader));
    expect(await readers()).toEqual([
      { day: "2026-11-10", readers: 2 },
      { day: "2026-11-11", readers: 1 },
    ]);
    expect(await DailyStat.findOne().lean()).toMatchObject({
      folderId: new Types.ObjectId(book.folderId),
      authorId: alice,
    });
  });

  it("parallel reads of one reader count once, of different readers each", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => recordRead(readOf(`u:${dave}`))),
    );
    expect((await readers())[0].readers).toBe(1);
    await Promise.all(
      Array.from({ length: 5 }, (_, index) => recordRead(readOf(`g:${index}`))),
    );
    expect((await readers())[0].readers).toBe(6);
    expect(await ReadEvent.countDocuments()).toBe(6);
  });

  it("a read event expires after 30 days", async () => {
    await recordRead(readOf(`u:${dave}`));
    const event = await ReadEvent.findOne().lean();
    expect(event!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect(event!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      30 * DAY,
    );
  });
});

describe("guests (criterion 2)", () => {
  it("counts a guest by a keyed hash of the trusted address", async () => {
    const reader = readerKey(null, withIp(IP))!;
    expect(reader).toMatch(/^g:[0-9a-f]{64}$/);
    expect(readerKey(null, withIp(IP))).toBe(reader);
    await recordRead(readOf(reader));
    await recordRead(readOf(readerKey(null, withIp(IP))!));
    expect((await readers())[0].readers).toBe(1);
    const stored = JSON.stringify(await ReadEvent.find().lean());
    expect(stored).not.toContain(IP);
    expect(JSON.stringify(await DailyStat.find().lean())).not.toContain(IP);
  });

  it("does not count a guest without a trusted address", () => {
    expect(readerKey(null, withIp())).toBeNull();
    vi.stubEnv("TRUSTED_IP_HEADER", "");
    expect(readerKey(null, withIp(IP))).toBeNull();
    expect(chapterReader(null, alice.toString(), withIp())).toBeNull();
  });

  it("counts a signed-in reader by account, without an address", () => {
    expect(readerKey(dave.toString(), withIp())).toBe(`u:${dave}`);
  });
});

describe("who is counted (criterion 3)", () => {
  it("leaves out the author and a prefetch", () => {
    expect(
      chapterReader(alice.toString(), alice.toString(), withIp(IP)),
    ).toBeNull();
    expect(
      chapterReader(
        dave.toString(),
        alice.toString(),
        new Headers({ "next-router-prefetch": "1" }),
      ),
    ).toBeNull();
    for (const [name, value] of [
      ["sec-purpose", "prefetch;prerender"],
      ["purpose", "prefetch"],
    ]) {
      expect(
        chapterReader(
          dave.toString(),
          alice.toString(),
          new Headers({ [name]: value }),
        ),
      ).toBeNull();
    }
    expect(chapterReader(dave.toString(), alice.toString(), withIp())).toBe(
      `u:${dave}`,
    );
  });
});

describe("daily counts stay (criterion 4)", () => {
  it("dailyStats outlives its readEvents", async () => {
    await recordRead(readOf(`u:${dave}`));
    // What the TTL monitor does after 30 days.
    await ReadEvent.deleteMany({});
    expect((await readers())[0].readers).toBe(1);
    const stats = await getAuthorStats(alice.toString(), 7, "en");
    expect(stats.books[0].chapters[0].readers).toBe(1);
  });
});

describe("the author's statistics (criteria 5, 6)", () => {
  it("only an author with a publication has them", async () => {
    expect(await hasPublication(alice.toString())).toBe(true);
    expect(await hasPublication(dave.toString())).toBe(false);
    await Folder.create({ userId: erin, name: "Draft", published: false });
    expect(await hasPublication(erin.toString())).toBe(false);
    await Folder.create({
      userId: erin,
      name: "Gone",
      published: true,
      deletedAt: new Date(),
    });
    expect(await hasPublication(erin.toString())).toBe(false);
  });

  it("shows only the session's own data", async () => {
    const bobs = await seedBook(bob, "Bobs");
    await recordRead({
      ...bobs,
      authorId: bob.toString(),
      reader: `u:${dave}`,
    });
    await Reaction.create({
      userId: dave,
      targetType: "story",
      targetId: bobs.storyId,
      authorId: bob,
      folderId: bobs.folderId,
      storyId: bobs.storyId,
      reaction: "heart",
      createdAt: new Date(),
    });
    await Follow.create({ followerId: dave, followeeId: bob });
    const stats = await getAuthorStats(alice.toString(), 30, "en");
    expect(stats.books.map(({ title }) => title)).toEqual(["Book"]);
    expect(stats.followers).toBe(0);
    expect(stats.days.every(({ readers }) => readers === 0)).toBe(true);
    expect(stats.books[0]).toMatchObject({ readers: 0, reactions: 0 });
  });

  it("matches the data: readers per day and the numbers per chapter and book", async () => {
    vi.useFakeTimers({
      now: new Date("2026-11-11T12:00:00Z"),
      toFake: ["Date"],
    });
    // The first chapter was created at real time; keep it older than the faked "Book two".
    await Story.collection.updateOne(
      { _id: new Types.ObjectId(book.storyId) },
      { $set: { createdAt: new Date("2026-11-10T12:00:00Z") } },
    );
    const second = await Story.create({
      userId: alice,
      folderId: book.folderId,
      title: "Book two",
      content: "text",
      publication: "public",
      publishedAt: new Date(),
    });
    const hiddenChapter = await Story.create({
      userId: alice,
      folderId: book.folderId,
      title: "Draft",
      content: "text",
    });
    const secondId = second._id.toString();
    await recordRead(readOf(`u:${dave}`));
    await recordRead(readOf(`u:${erin}`));
    await recordRead(readOf(`u:${dave}`, { ...book, storyId: secondId }));
    // Days before: one in the 7-day range, one only in the 30-day one.
    await DailyStat.create([
      {
        storyId: book.storyId,
        folderId: book.folderId,
        authorId: alice,
        day: "2026-11-09",
        readers: 3,
      },
      {
        storyId: book.storyId,
        folderId: book.folderId,
        authorId: alice,
        day: "2026-10-20",
        readers: 4,
      },
    ]);
    // A chapter not in the table is not in the chart either.
    await DailyStat.create({
      storyId: hiddenChapter._id,
      folderId: book.folderId,
      authorId: alice,
      day: "2026-11-11",
      readers: 10,
    });
    const banned = await createUser("Banned");
    await User.updateOne(
      { _id: banned },
      { globalBan: { until: null, reason: "Spam", by: bob, at: new Date() } },
    );
    const reaction = (userId: Types.ObjectId, storyId: string) => ({
      userId,
      targetType: "story" as const,
      targetId: storyId,
      authorId: alice,
      folderId: book.folderId,
      storyId,
      reaction: "heart" as const,
      createdAt: new Date(),
    });
    await Reaction.create([
      reaction(dave, book.storyId),
      reaction(erin, book.storyId),
      reaction(dave, secondId),
    ]);
    const rating = (
      userId: Types.ObjectId,
      value: number,
      storyId: string | null,
    ) => ({
      userId,
      targetType: storyId ? ("story" as const) : ("folder" as const),
      targetId: storyId ?? book.folderId,
      authorId: alice,
      folderId: book.folderId,
      storyId,
      value,
      updatedAt: new Date(),
    });
    await Rating.create([
      rating(dave, 5, book.storyId),
      rating(erin, 2, book.storyId),
      rating(banned, 1, book.storyId),
      rating(dave, 4, null),
    ]);
    const comment = (
      userId: Types.ObjectId,
      storyId: string | null,
      extra = {},
    ) => ({
      authorId: alice,
      userId,
      folderId: book.folderId,
      storyId,
      body: "Hi",
      ...extra,
    });
    await Comment.create([
      comment(dave, book.storyId),
      comment(erin, book.storyId),
      comment(dave, book.storyId, { deletedAt: new Date() }),
      comment(dave, book.storyId, {
        hidden: { by: alice, at: new Date() },
      }),
      comment(banned, book.storyId),
      comment(dave, null),
    ]);
    await LibraryItem.create([
      { userId: dave, folderId: book.folderId, addedAt: new Date() },
      { userId: erin, folderId: book.folderId, addedAt: new Date() },
    ]);
    await Follow.create([
      { followerId: dave, followeeId: alice },
      { followerId: banned, followeeId: alice },
    ]);

    const week = await getAuthorStats(alice.toString(), 7, "en");
    expect(week.days).toHaveLength(7);
    expect(week.days.at(-1)).toEqual({ day: "2026-11-11", readers: 3 });
    expect(week.days.at(-3)).toEqual({ day: "2026-11-09", readers: 3 });
    expect(week.days.filter(({ readers }) => readers > 0)).toHaveLength(2);
    expect(week.followers).toBe(1);
    const [row] = week.books;
    expect(row).toMatchObject({
      title: "Book",
      readers: 6,
      reactions: 3,
      ratingCount: 1,
      ratingSum: 4,
      comments: 3,
      library: 2,
    });
    expect(row.chapters.map(({ id }) => id)).not.toContain(
      hiddenChapter._id.toString(),
    );
    expect(row.chapters).toEqual([
      {
        id: book.storyId,
        title: "Book one",
        readers: 5,
        reactions: 2,
        ratingCount: 2,
        ratingSum: 7,
        comments: 2,
      },
      {
        id: secondId,
        title: "Book two",
        readers: 1,
        reactions: 1,
        ratingCount: 0,
        ratingSum: 0,
        comments: 0,
      },
    ]);
    const month = await getAuthorStats(alice.toString(), 30, "en");
    expect(month.days).toHaveLength(30);
    expect(month.books[0].chapters[0].readers).toBe(9);
  });
});

describe("purge and move (task 69)", () => {
  it("purging a chapter or a book deletes its reads and daily counts", async () => {
    const other = await seedBook(alice, "Other");
    await recordRead(readOf(`u:${dave}`));
    await recordRead(readOf(`u:${dave}`, other));
    await purgeSocialData({ folderIds: [], storyIds: [book.storyId] });
    expect(await ReadEvent.countDocuments({ storyId: book.storyId })).toBe(0);
    expect(await DailyStat.countDocuments({ storyId: book.storyId })).toBe(0);
    expect(await ReadEvent.countDocuments()).toBe(1);
    expect(await DailyStat.countDocuments()).toBe(1);
    await purgeSocialData({ folderIds: [other.folderId], storyIds: [] });
    expect(await ReadEvent.countDocuments()).toBe(0);
    expect(await DailyStat.countDocuments()).toBe(0);
  });

  it("a moved chapter takes its reads and daily counts to the new book", async () => {
    await recordRead(readOf(`u:${dave}`));
    const other = await Folder.create({
      userId: alice,
      name: "Other",
      published: true,
    });
    vi.mocked(requireUser).mockResolvedValue({
      ok: true,
      userId: alice.toString(),
    });
    expect(await moveStory(book.storyId, other._id.toString())).toEqual({
      ok: true,
    });
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await ReadEvent.find().lean()).toEqual([
      expect.objectContaining({ folderId: other._id }),
    ]);
    expect(await DailyStat.find().lean()).toEqual([
      expect.objectContaining({ folderId: other._id, readers: 1 }),
    ]);
  });
});
