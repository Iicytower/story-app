import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { follow, unfollow } from "@/app/[locale]/p/[nickname]/actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { Follow } from "@/lib/models/follow";
import { User } from "@/lib/models/user";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const FORBIDDEN = {
  ok: false,
  error: "FORBIDDEN",
  message: en.errors.interactionNotAllowed,
};
const NOT_FOUND = {
  ok: false,
  error: "NOT_FOUND",
  message: en.errors.userNotFound,
};

let dave: Types.ObjectId;
let alice: Types.ObjectId;

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

const follows = () =>
  Follow.find({}, { _id: 0, followerId: 1, followeeId: 1 }).lean();

beforeEach(async () => {
  dave = await createUser("Dave");
  alice = await createUser("Alice");
  signInAs(dave);
});

describe("follow and unfollow", () => {
  it("follows and stops following, by nickname in any case", async () => {
    expect(await follow("alice")).toEqual({ ok: true, following: true });
    expect(await follows()).toEqual([{ followerId: dave, followeeId: alice }]);
    expect(await unfollow("Alice")).toEqual({ ok: true, following: false });
    expect(await follows()).toEqual([]);
    expect(await unfollow("Alice")).toEqual({ ok: true, following: false });
  });

  it("does not duplicate a follow, also when two requests race", async () => {
    await follow("Alice");
    await Promise.all([follow("Alice"), follow("Alice"), follow("Alice")]);
    expect(await Follow.countDocuments()).toBe(1);
  });

  it("has a unique index on the pair", async () => {
    await Follow.create({ followerId: dave, followeeId: alice });
    await expect(
      Follow.create({ followerId: dave, followeeId: alice }),
    ).rejects.toThrow(/duplicate key/);
    await Follow.create({ followerId: alice, followeeId: dave });
    expect(await Follow.countDocuments()).toBe(2);
  });

  it("refuses following oneself", async () => {
    expect(await follow("Dave")).toEqual(FORBIDDEN);
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("refuses when the followee blocked the follower", async () => {
    await Block.create({ blockerId: alice, blockedId: dave });
    expect(await follow("Alice")).toEqual(FORBIDDEN);
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("refuses when the follower blocked the followee", async () => {
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await follow("Alice")).toEqual(FORBIDDEN);
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("refuses a globally banned follower", async () => {
    await User.updateOne(
      { _id: dave },
      {
        globalBan: {
          until: null,
          reason: "spam",
          by: alice,
          at: new Date(),
        },
      },
    );
    expect(await follow("Alice")).toEqual(FORBIDDEN);
  });

  it("does not find a globally banned followee", async () => {
    await User.updateOne(
      { _id: alice },
      {
        globalBan: {
          until: new Date(Date.now() + DAY),
          reason: "spam",
          by: dave,
          at: new Date(),
        },
      },
    );
    expect(await follow("Alice")).toEqual(NOT_FOUND);
  });

  it("allows following during a community ban", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "Spam",
      by: alice,
    });
    expect(await follow("Alice")).toEqual({ ok: true, following: true });
  });

  it("lets the follower leave after a block", async () => {
    await follow("Alice");
    await Block.create({ blockerId: alice, blockedId: dave });
    expect(await unfollow("Alice")).toEqual({ ok: true, following: false });
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("does not find an unknown nickname", async () => {
    expect(await follow("Nobody")).toEqual(NOT_FOUND);
    expect(await unfollow("Nobody")).toEqual(NOT_FOUND);
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("rejects what is not a string", async () => {
    for (const value of [123, {}, { $ne: "" }, null, ["Alice"]]) {
      for (const action of [follow, unfollow]) {
        expect(await action(value as unknown as string)).toEqual({
          ok: false,
          error: "INVALID_INPUT",
          message: en.errors.requestInvalid,
        });
      }
    }
  });

  it("requires a session", async () => {
    signInAs(null);
    for (const action of [follow, unfollow]) {
      expect(await action("Alice")).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Signed out",
      });
    }
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("follows only as the session's user", async () => {
    const erin = await createUser("Erin");
    signInAs(erin);
    await follow("Alice");
    expect(await follows()).toEqual([{ followerId: erin, followeeId: alice }]);
  });
});

describe("follow limit", () => {
  it("allows 60 follows and unfollows a minute, then refuses", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const minute = Date.now() - (Date.now() % 60_000) + 1000;
    vi.setSystemTime(minute);
    try {
      for (let i = 0; i < 30; i++) {
        expect(await follow("Alice")).toMatchObject({ ok: true });
        expect(await unfollow("Alice")).toMatchObject({ ok: true });
      }
      expect(await follow("Alice")).toEqual({
        ok: false,
        error: "RATE_LIMITED",
        message: en.errors.tooManyAttempts,
      });
      expect(await Follow.countDocuments()).toBe(0);

      vi.setSystemTime(minute + 60_000);
      expect(await follow("Alice")).toEqual({ ok: true, following: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives an account younger than a day half of the limit", async () => {
    const { _id: young } = await User.create({
      nickname: "Young",
      passwordHash: "x",
    });
    signInAs(young);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() - (Date.now() % 60_000) + 1000);
    try {
      for (let i = 0; i < 15; i++) {
        await follow("Alice");
        await unfollow("Alice");
      }
      expect(await follow("Alice")).toMatchObject({ error: "RATE_LIMITED" });
    } finally {
      vi.useRealTimers();
    }
  });
});
