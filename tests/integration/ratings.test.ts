import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { moveStory } from "@/app/[locale]/(protected)/stories/actions";
import {
  rate,
  removeRating,
} from "@/app/[locale]/p/[nickname]/[folder]/rating-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { Folder } from "@/lib/models/folder";
import { Rating } from "@/lib/models/rating";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS } from "@/lib/rate-limit";
import { purgeSocialData } from "@/lib/social/cascade";
import { getRating } from "@/lib/social/rating-summary";
import { ratingAverage, type RatingTarget } from "@/lib/social/ratings";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const error = (code: string, key: keyof typeof en.errors) => ({
  ok: false,
  error: code,
  message: en.errors[key],
});
const NOT_FOUND = error("NOT_FOUND", "ratingTargetNotFound");
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");
const INVALID = error("INVALID_INPUT", "requestInvalid");
const GLOBAL_BAN = (by: Types.ObjectId) => ({
  globalBan: { until: null, reason: "Spam", by, at: new Date() },
});

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string | null, age = 2 * DAY) {
  const { insertedId } = await User.collection.insertOne({
    ...(nickname && { nickname }),
    passwordHash: "x",
    createdAt: new Date(Date.now() - age),
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

async function seedBook() {
  const folder = await Folder.create({
    userId: alice,
    name: "Book",
    published: true,
  });
  const chapter = await Story.create({
    userId: alice,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id.toString(), storyId: chapter._id.toString() };
}

const id = (type: RatingTarget) =>
  type === "story" ? book.storyId : book.folderId;

const rateAs = (as: Types.ObjectId, type: RatingTarget, value: number) => {
  signInAs(as);
  return rate(type, id(type), value);
};

const summary = async (viewer: Types.ObjectId | null, type: RatingTarget) =>
  getRating(viewer?.toString() ?? null, type, id(type));

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  book = await seedBook();
});

describe("one rating per object (criterion 1)", () => {
  it.each(["story", "folder"] as const)(
    "a %s rating is set, replaced and removed",
    async (type) => {
      expect(await rateAs(dave, type, 4)).toEqual({ ok: true, value: 4 });
      expect(await Rating.findOne().lean()).toMatchObject({
        userId: dave,
        targetType: type,
        targetId: new Types.ObjectId(id(type)),
        authorId: alice,
        folderId: new Types.ObjectId(book.folderId),
        storyId: type === "story" ? new Types.ObjectId(book.storyId) : null,
        value: 4,
      });
      expect(await rateAs(dave, type, 2)).toEqual({ ok: true, value: 2 });
      expect(await Rating.countDocuments()).toBe(1);
      const set = await Rating.findOne().lean();
      expect(set).toMatchObject({ value: 2 });
      // The same value again keeps the date.
      expect(await rateAs(dave, type, 2)).toEqual({ ok: true, value: 2 });
      expect(await Rating.findOne().lean()).toEqual(set);
      expect(await removeRating(type, id(type))).toEqual({ ok: true });
      expect(await Rating.countDocuments()).toBe(0);
      // Removing nothing is fine.
      expect(await removeRating(type, id(type))).toEqual({ ok: true });
    },
  );

  it("a chapter and its book are rated apart", async () => {
    await rateAs(dave, "story", 5);
    await rateAs(dave, "folder", 3);
    expect((await summary(dave, "story")).summary.mine).toBe(5);
    expect((await summary(dave, "folder")).summary.mine).toBe(3);
  });

  it("parallel requests leave a single document", async () => {
    signInAs(dave);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((value) => rate("story", book.storyId, value)),
    );
    for (const result of results) expect(result).toMatchObject({ ok: true });
    expect(await Rating.countDocuments()).toBe(1);
  });

  it("is limited per account, half for a new account", async () => {
    const young = await createUser("Young", 1000);
    for (let i = 0; i < SOCIAL_LIMITS.rate.max / 2; i++) {
      expect(await rateAs(young, "story", 1 + (i % 5))).toMatchObject({
        ok: true,
      });
    }
    expect(await rateAs(young, "story", 3)).toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
  });

  it("an account without a nickname rates: ratings name nobody", async () => {
    const anonymous = await createUser(null);
    expect(await rateAs(anonymous, "story", 3)).toEqual({
      ok: true,
      value: 3,
    });
  });
});

describe("average and count, anonymous (criterion 2)", () => {
  it("match the ratings; a guest sees them, the rater their own", async () => {
    await rateAs(dave, "story", 5);
    await rateAs(erin, "story", 2);
    const frank = await createUser("Frank");
    await rateAs(frank, "story", 4);
    const guest = await summary(null, "story");
    expect(guest).toEqual({
      summary: { count: 3, sum: 11, mine: null },
      own: false,
    });
    expect(ratingAverage(guest.summary)).toBeCloseTo(11 / 3);
    expect((await summary(erin, "story")).summary.mine).toBe(2);
    expect(await summary(null, "folder")).toEqual({
      summary: { count: 0, sum: 0, mine: null },
      own: false,
    });
    expect(ratingAverage((await summary(null, "folder")).summary)).toBeNull();
  });

  it("no answer carries a rater's id, not even the author's page", async () => {
    const answer = await rateAs(dave, "story", 5);
    await rateAs(erin, "folder", 3);
    const pages = await Promise.all([
      summary(null, "story"),
      summary(alice, "story"),
      summary(alice, "folder"),
      summary(erin, "story"),
    ]);
    for (const shown of [answer, ...pages]) {
      const text = JSON.stringify(shown);
      expect(text).not.toContain(dave.toString());
      expect(text).not.toContain(erin.toString());
    }
    expect(pages[1]).toEqual({
      summary: { count: 1, sum: 5, mine: null },
      own: true,
    });
    expect(pages[2]).toMatchObject({ own: true });
    signInAs(erin);
    expect(
      JSON.stringify(await removeRating("folder", book.folderId)),
    ).not.toContain(erin.toString());
  });

  it("leave out globally banned raters for everyone", async () => {
    await rateAs(dave, "story", 1);
    await rateAs(erin, "story", 5);
    await User.updateOne({ _id: dave }, GLOBAL_BAN(alice));
    for (const viewer of [null, alice, erin]) {
      expect((await summary(viewer, "story")).summary).toMatchObject({
        count: 1,
        sum: 5,
      });
    }
  });
});

describe("input and one's own text (criterion 3)", () => {
  it.each([0, 6, 2.5, -1, Number.NaN, "3", null, undefined])(
    "the value %s is INVALID_INPUT",
    async (value) => {
      signInAs(dave);
      expect(await rate("story", book.storyId, value as never)).toEqual(
        INVALID,
      );
      expect(await Rating.countDocuments()).toBe(0);
    },
  );

  it("rejects a bad target, a bad id and a signed-out caller", async () => {
    signInAs(dave);
    expect(await rate("comment" as never, book.storyId, 3)).toEqual(INVALID);
    expect(await rate("story", "nope", 3)).toEqual(INVALID);
    expect(await removeRating("post" as never, book.storyId)).toEqual(INVALID);
    expect(await rate("story", new Types.ObjectId().toString(), 3)).toEqual(
      NOT_FOUND,
    );
    signInAs(null);
    for (const result of [
      await rate("story", book.storyId, 3),
      await rate("story", book.storyId, 9),
      await removeRating("story", book.storyId),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
    }
    expect(await Rating.countDocuments()).toBe(0);
  });

  it("the author does not rate their own chapter or book", async () => {
    expect(await rateAs(alice, "story", 5)).toEqual(REFUSED);
    expect(await rateAs(alice, "folder", 5)).toEqual(REFUSED);
    expect(await Rating.countDocuments()).toBe(0);
  });
});

describe("bans, blocks and visibility refuse a rating (criterion 4)", () => {
  const both = async (expected: unknown) => {
    expect(await rateAs(dave, "story", 4)).toEqual(expected);
    expect(await rateAs(dave, "folder", 4)).toEqual(expected);
  };

  it("a ban in the author's community", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "Spam",
      by: alice,
    });
    await both(REFUSED);
  });

  it("an expired community ban does not", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: new Date(Date.now() - 1000),
      reason: "Spam",
      by: alice,
    });
    await both({ ok: true, value: 4 });
  });

  it("a global ban of the reader", async () => {
    await User.updateOne({ _id: dave }, GLOBAL_BAN(alice));
    await both(REFUSED);
  });

  it("a global ban of the author hides the text", async () => {
    await User.updateOne({ _id: alice }, GLOBAL_BAN(dave));
    await both(NOT_FOUND);
  });

  it("a block by the author", async () => {
    await Block.create({ blockerId: alice, blockedId: dave });
    await both(REFUSED);
  });

  it("a block of the author by the reader hides the text", async () => {
    await Block.create({ blockerId: dave, blockedId: alice });
    await both(NOT_FOUND);
  });

  it("a chapter no longer public; republished, its ratings are back", async () => {
    await rateAs(erin, "story", 5);
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    expect(await rateAs(dave, "story", 4)).toEqual(NOT_FOUND);
    // A book without a public chapter is not public either (D38).
    expect(await rateAs(dave, "folder", 4)).toEqual(NOT_FOUND);
    expect(await Rating.countDocuments()).toBe(1);
    await Story.updateOne({ _id: book.storyId }, { publication: "public" });
    expect((await summary(null, "story")).summary.count).toBe(1);
  });

  it("an unpublished or deleted book and a deleted chapter", async () => {
    await Folder.updateOne({ _id: book.folderId }, { published: false });
    await both(NOT_FOUND);
    await Folder.updateOne({ _id: book.folderId }, { deletedAt: new Date() });
    await both(NOT_FOUND);
    await Folder.updateOne(
      { _id: book.folderId },
      { published: true, deletedAt: null },
    );
    await Story.updateOne({ _id: book.storyId }, { deletedAt: new Date() });
    expect(await rateAs(dave, "story", 4)).toEqual(NOT_FOUND);
  });
});

describe("removing one's own rating", () => {
  const remove = async (type: RatingTarget) => {
    signInAs(dave);
    expect(await removeRating(type, id(type))).toEqual({ ok: true });
  };

  beforeEach(async () => {
    await rateAs(dave, "story", 4);
    await rateAs(dave, "folder", 4);
    await rateAs(erin, "story", 2);
  });

  const left = async () =>
    expect(await Rating.find().select({ userId: 1 }).lean()).toEqual([
      expect.objectContaining({ userId: erin }),
    ]);

  it("works under a community ban", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "Spam",
      by: alice,
    });
    await remove("story");
    await remove("folder");
    await left();
  });

  it("works under a global ban and a block either way", async () => {
    await User.updateOne({ _id: dave }, GLOBAL_BAN(alice));
    await Block.create({ blockerId: alice, blockedId: dave });
    await Block.create({ blockerId: dave, blockedId: alice });
    await remove("story");
    await remove("folder");
    await left();
  });

  it("works when the text is no longer public", async () => {
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    await Folder.updateOne({ _id: book.folderId }, { published: false });
    await remove("story");
    await remove("folder");
    await left();
  });

  it("removes only the caller's own rating", async () => {
    signInAs(erin);
    expect(await removeRating("folder", book.folderId)).toEqual({ ok: true });
    expect(await Rating.countDocuments()).toBe(3);
  });
});

describe("deletion", () => {
  it("purging a chapter or a book deletes its ratings", async () => {
    await rateAs(dave, "story", 4);
    await rateAs(dave, "folder", 4);
    await purgeSocialData({ folderIds: [], storyIds: [book.storyId] });
    expect(await Rating.find().select({ targetType: 1 }).lean()).toEqual([
      expect.objectContaining({ targetType: "folder" }),
    ]);
    await rateAs(erin, "story", 2);
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await Rating.countDocuments()).toBe(0);
  });

  it("a moved chapter takes its ratings along, the book keeps its own", async () => {
    await rateAs(dave, "story", 4);
    await rateAs(dave, "folder", 4);
    const other = await Folder.create({
      userId: alice,
      name: "Other",
      published: true,
    });
    signInAs(alice);
    expect(await moveStory(book.storyId, other._id.toString())).toEqual({
      ok: true,
    });
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await Rating.find().lean()).toEqual([
      expect.objectContaining({ targetType: "story", folderId: other._id }),
    ]);
  });
});
