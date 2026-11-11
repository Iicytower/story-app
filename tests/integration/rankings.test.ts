import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { Ranking } from "@/lib/models/ranking";
import { Rating } from "@/lib/models/rating";
import { ReadEvent } from "@/lib/models/read-event";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { purgeSocialData } from "@/lib/social/cascade";
import {
  getHomeRankings,
  recomputeRanking,
  recomputeStaleRankings,
} from "@/lib/social/ranking-queries";
import { RANKING_LEASE_MS, RANKING_MAX_AGE_MS } from "@/lib/social/rankings";
import { statsDay } from "@/lib/social/read-stats";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;

let alice: Types.ObjectId;
let bob: Types.ObjectId;
let viewer: Types.ObjectId;

async function createUser(nickname: string) {
  return (await User.create({ nickname, passwordHash: "x" }))._id;
}

async function banGlobally(userId: Types.ObjectId) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        globalBan: { until: null, reason: "spam", by: alice, at: new Date() },
      },
    },
  );
}

async function seedBook(owner: Types.ObjectId, name: string, tags?: string[]) {
  const folder = await Folder.create({
    userId: owner,
    name,
    published: true,
    tags,
  });
  const story = await Story.create({
    userId: owner,
    folderId: folder._id,
    title: `${name} one`,
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id, storyId: story._id, owner };
}

type Book = Awaited<ReturnType<typeof seedBook>>;

async function read(book: Book, readers: string[], daysAgo = 0) {
  await ReadEvent.insertMany(
    readers.map((reader) => ({
      storyId: book.storyId,
      folderId: book.folderId,
      day: statsDay(new Date(Date.now() - daysAgo * DAY)),
      reader,
      expiresAt: new Date(Date.now() + 30 * DAY),
    })),
  );
}

async function rate(book: Book, values: number[], raters?: Types.ObjectId[]) {
  await Rating.insertMany(
    values.map((value, index) => ({
      userId: raters?.[index] ?? new Types.ObjectId(),
      targetType: "folder",
      targetId: book.folderId,
      authorId: book.owner,
      folderId: book.folderId,
      storyId: null,
      value,
      updatedAt: new Date(),
    })),
  );
}

async function stored(key: string) {
  const doc = await Ranking.findById(key).lean();
  return (doc?.items ?? []).map(({ folderId, score }) => ({
    folderId: folderId.toString(),
    score,
  }));
}

const names = (books: { name: string }[]) => books.map(({ name }) => name);

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  viewer = await createUser("Viewer");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("weekly ranking", () => {
  it("counts unique readers of each book over the last 7 days", async () => {
    const one = await seedBook(alice, "One");
    const two = await seedBook(bob, "Two");
    const second = await Story.create({
      userId: alice,
      folderId: one.folderId,
      title: "One two",
      publication: "public",
    });
    await read(one, ["u:1", "g:a"]);
    await read(one, ["u:1"], 1);
    await read({ ...one, storyId: second._id }, ["u:1"]);
    // Out of the week.
    await read(one, ["u:2", "u:3", "u:4"], 7);
    await read(two, ["u:1", "u:2", "u:3"], 6);

    expect(await recomputeRanking("weekly")).toBe(true);
    expect(await stored("weekly")).toEqual([
      { folderId: two.folderId.toString(), score: 3 },
      { folderId: one.folderId.toString(), score: 2 },
    ]);
  });

  it("does not count globally banned readers", async () => {
    const one = await seedBook(alice, "One");
    await read(one, [`u:${bob}`, `u:${viewer}`]);
    await banGlobally(bob);
    await recomputeRanking("weekly");
    expect(await stored("weekly")).toEqual([
      { folderId: one.folderId.toString(), score: 1 },
    ]);
  });

  it("ranks each predefined category present in the data", async () => {
    await PredefinedTag.create([
      { _id: "fantasy", labels: { en: "Fantasy", pl: "Fantastyka" } },
      { _id: "horror", labels: { en: "Horror", pl: "Horror" } },
    ]);
    const one = await seedBook(alice, "One", ["fantasy", "own"]);
    const two = await seedBook(bob, "Two", ["fantasy"]);
    await seedBook(bob, "Three", ["own"]);
    await read(one, ["u:1"]);
    await read(two, ["u:1", "u:2"]);
    await recomputeRanking("weekly");

    expect(
      (await stored("tag:fantasy")).map(({ folderId }) => folderId),
    ).toEqual([two.folderId.toString(), one.folderId.toString()]);
    expect(await Ranking.findById("tag:horror")).toBeNull();
    expect(await Ranking.findById("tag:own")).toBeNull();
    const home = await getHomeRankings(null);
    expect(
      home.tags.map(({ key, books }) => ({ key, books: names(books) })),
    ).toEqual([{ key: "fantasy", books: ["Two", "One"] }]);
  });
});

describe("top rated", () => {
  it("ranks books with at least 5 ratings by the Bayesian average", async () => {
    const few = await seedBook(alice, "Few");
    const good = await seedBook(alice, "Good");
    const best = await seedBook(bob, "Best");
    await rate(few, [5, 5, 5, 5]);
    await rate(good, [4, 4, 4, 4, 4]);
    await rate(best, [5, 5, 5, 5, 5, 5]);
    await recomputeRanking("topRated");

    // C = (20 + 20 + 30) / 15
    const mean = 70 / 15;
    expect(await stored("topRated")).toEqual([
      {
        folderId: best.folderId.toString(),
        score: (mean * 5 + 30) / 11,
      },
      {
        folderId: good.folderId.toString(),
        score: (mean * 5 + 20) / 10,
      },
    ]);
  });

  it("does not count ratings of globally banned accounts", async () => {
    const book = await seedBook(alice, "Book");
    const raters = [
      bob,
      ...Array.from({ length: 4 }, () => new Types.ObjectId()),
    ];
    await rate(book, [5, 5, 5, 5, 5], raters);
    await banGlobally(bob);
    await recomputeRanking("topRated");
    expect(await stored("topRated")).toEqual([]);
  });

  it("leaves out unpublished books and books of globally banned authors", async () => {
    const hidden = await seedBook(alice, "Hidden");
    const banned = await seedBook(bob, "Banned");
    await Folder.updateOne(
      { _id: hidden.folderId },
      { $set: { published: false } },
    );
    await banGlobally(bob);
    await rate(hidden, [5, 5, 5, 5, 5]);
    await rate(banned, [5, 5, 5, 5, 5]);
    await recomputeRanking("topRated");
    expect(await stored("topRated")).toEqual([]);
  });
});

describe("lazy recomputation", () => {
  it("recomputes at most once an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const one = await seedBook(alice, "One");
    await read(one, ["u:1"]);
    expect(await recomputeRanking("weekly")).toBe(true);
    await read(one, ["u:2"]);
    vi.setSystemTime(Date.now() + RANKING_MAX_AGE_MS - 1000);
    expect(await recomputeRanking("weekly")).toBe(false);
    expect((await stored("weekly"))[0].score).toBe(1);
    vi.setSystemTime(Date.now() + 1000);
    expect(await recomputeRanking("weekly")).toBe(true);
    expect((await stored("weekly"))[0].score).toBe(2);
  });

  it("lets only one of parallel requests compute", async () => {
    const one = await seedBook(alice, "One");
    await read(one, ["u:1"]);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => recomputeRanking("weekly")),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const topRated = await Promise.all([
      recomputeRanking("topRated"),
      recomputeRanking("topRated"),
    ]);
    expect(topRated.toSorted()).toEqual([false, true]);
  });

  it("takes over a claim whose lease has ended", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await Ranking.create({
      _id: "weekly",
      items: [],
      computedAt: new Date(0),
      computing: new Date(Date.now() + RANKING_LEASE_MS),
    });
    expect(await recomputeRanking("weekly")).toBe(false);
    vi.setSystemTime(Date.now() + RANKING_LEASE_MS);
    expect(await recomputeRanking("weekly")).toBe(true);
    expect((await Ranking.findById("weekly").lean())?.computing).toBeNull();
  });

  it("shows the old result and recomputes after the response", async () => {
    const one = await seedBook(alice, "One");
    await read(one, ["u:1"]);
    expect((await getHomeRankings(null)).weekly).toEqual([]);
    await flushAfter();
    expect(names((await getHomeRankings(null)).weekly)).toEqual(["One"]);

    // A fresh result is not recomputed.
    const two = await seedBook(bob, "Two");
    await read(two, ["u:1", "u:2"]);
    await getHomeRankings(null);
    await flushAfter();
    expect(names((await getHomeRankings(null)).weekly)).toEqual(["One"]);
  });

  it("schedules nothing while another request computes", async () => {
    await Ranking.create([
      {
        _id: "weekly",
        items: [],
        computedAt: new Date(0),
        computing: new Date(Date.now() + RANKING_LEASE_MS),
      },
      { _id: "topRated", items: [], computedAt: new Date() },
    ]);
    await getHomeRankings(null);
    expect((globalThis as { afterTasks?: unknown[] }).afterTasks).toEqual([]);
  });

  it("does not overwrite categories of a newer computation", async () => {
    await PredefinedTag.create({
      _id: "fantasy",
      labels: { en: "Fantasy", pl: "Fantastyka" },
    });
    const one = await seedBook(alice, "One", ["fantasy"]);
    await read(one, ["u:1"]);
    const newer = new Date(Date.now() + 60_000);
    await Ranking.create({ _id: "tag:fantasy", items: [], computedAt: newer });
    expect(await recomputeRanking("weekly")).toBe(true);
    const tag = await Ranking.findById("tag:fantasy").lean();
    expect(tag).toMatchObject({ items: [], computedAt: newer });
  });

  it("recomputes both stored rankings", async () => {
    await recomputeStaleRankings();
    const ids = (await Ranking.find().select({ _id: 1 }).lean()).map(
      ({ _id }) => _id,
    );
    expect(ids.toSorted()).toEqual(["topRated", "weekly"]);
  });
});

describe("visibility at read time", () => {
  let one: Book;
  let two: Book;

  beforeEach(async () => {
    one = await seedBook(alice, "One");
    two = await seedBook(bob, "Two");
    await read(one, ["u:1", "u:2"]);
    await read(two, ["u:1"]);
    await rate(one, [5, 5, 5, 5, 5]);
    await rate(two, [4, 4, 4, 4, 4]);
    await recomputeStaleRankings();
  });

  const shown = async (viewerId: Types.ObjectId | null) => {
    const home = await getHomeRankings(viewerId?.toString() ?? null);
    return { weekly: names(home.weekly), topRated: names(home.topRated) };
  };

  it("shows both books with covers, paths and authors", async () => {
    const home = await getHomeRankings(null);
    expect(home.weekly).toEqual([
      expect.objectContaining({
        name: "One",
        nickname: "Alice",
        path: "/p/Alice/one",
        adult: false,
        cover: null,
      }),
      expect.objectContaining({ name: "Two", nickname: "Bob" }),
    ]);
    expect(names(home.topRated)).toEqual(["One", "Two"]);
  });

  it("leaves out an unpublished book", async () => {
    await Folder.updateOne(
      { _id: one.folderId },
      { $set: { published: false } },
    );
    expect(await shown(null)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
  });

  it("leaves out a book without a public chapter", async () => {
    await Story.updateOne(
      { _id: one.storyId },
      { $set: { publication: "hidden" } },
    );
    expect(await shown(null)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
  });

  it("leaves out a deleted book", async () => {
    await Folder.updateOne(
      { _id: one.folderId },
      { $set: { deletedAt: new Date() } },
    );
    expect(await shown(viewer)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
  });

  it("leaves out books of an author banned globally after the computation", async () => {
    await banGlobally(alice);
    expect(await shown(null)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
    expect(await shown(viewer)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
  });

  it("leaves out books of an author the viewer blocked, for that viewer only", async () => {
    await Block.create({ blockerId: viewer, blockedId: alice });
    expect(await shown(viewer)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
    expect(await shown(bob)).toEqual({
      weekly: ["One", "Two"],
      topRated: ["One", "Two"],
    });
  });

  it("leaves out books of an author who blocked the viewer", async () => {
    await Block.create({ blockerId: alice, blockedId: viewer });
    expect(await shown(viewer)).toEqual({ weekly: ["Two"], topRated: ["Two"] });
  });

  it("marks an 18+ book", async () => {
    await Folder.updateOne(
      { _id: two.folderId },
      { $set: { adult: { manual: true, auto: false } } },
    );
    const home = await getHomeRankings(null);
    expect(home.weekly.map(({ adult }) => adult)).toEqual([false, true]);
  });

  it("drops a purged book from the stored rankings", async () => {
    await purgeSocialData({
      folderIds: [one.folderId.toString()],
      storyIds: [],
    });
    expect(await stored("weekly")).toEqual([
      { folderId: two.folderId.toString(), score: 1 },
    ]);
    expect((await stored("topRated")).map(({ folderId }) => folderId)).toEqual([
      two.folderId.toString(),
    ]);
  });
});

describe("from followed authors", () => {
  it("is null for a guest and lists followed authors' latest public chapters", async () => {
    const one = await seedBook(alice, "One");
    await seedBook(bob, "Two");
    await Story.create({
      userId: alice,
      folderId: one.folderId,
      title: "Draft",
      publication: "hidden",
    });
    await Story.create({
      userId: alice,
      folderId: one.folderId,
      title: "Newer",
      publication: "public",
      publishedAt: new Date(Date.now() + 1000),
    });
    await Follow.create({ followerId: viewer, followeeId: alice });

    expect((await getHomeRankings(null)).followed).toBeNull();
    const { followed } = await getHomeRankings(viewer.toString());
    expect(followed).toEqual([
      expect.objectContaining({
        title: "Newer",
        path: "/p/Alice/one/newer",
        book: expect.objectContaining({ name: "One" }),
      }),
      expect.objectContaining({
        title: "One one",
        path: "/p/Alice/one/one-one",
      }),
    ]);
    expect((await getHomeRankings(bob.toString())).followed).toEqual([]);
  });

  it("leaves out authors hidden from the viewer", async () => {
    await seedBook(alice, "One");
    await Follow.create({ followerId: viewer, followeeId: alice });
    await Block.create({ blockerId: alice, blockedId: viewer });
    expect((await getHomeRankings(viewer.toString())).followed).toEqual([]);
  });
});
