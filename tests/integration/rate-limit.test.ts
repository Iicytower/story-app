import { describe, expect, it, vi } from "vitest";
import { RateLimit } from "@/lib/models/rate-limit";
import { User } from "@/lib/models/user";
import {
  giveBackAttempt,
  SOCIAL_LIMITS,
  takeAttempt,
  takeUserAttempt,
} from "@/lib/rate-limit";
import { setupTestDb } from "./test-db";

setupTestDb();

const RULE = { name: "test", max: 3, windowMs: 60_000 };

describe("takeAttempt", () => {
  it("refuses attempts over the limit", async () => {
    for (let i = 0; i < RULE.max; i++) {
      await expect(takeAttempt(RULE, "1.1.1.1")).resolves.not.toBeNull();
    }
    await expect(takeAttempt(RULE, "1.1.1.1")).resolves.toBeNull();
  });

  it("never lets more than the limit through in parallel", async () => {
    const slots = await Promise.all(
      Array.from({ length: 20 }, () => takeAttempt(RULE, "1.1.1.1")),
    );
    expect(slots.filter(Boolean)).toHaveLength(RULE.max);
  });

  it("counts every address and rule separately", async () => {
    for (let i = 0; i < RULE.max; i++) await takeAttempt(RULE, "1.1.1.1");

    await expect(takeAttempt(RULE, "2.2.2.2")).resolves.not.toBeNull();
    await expect(
      takeAttempt({ ...RULE, name: "other" }, "1.1.1.1"),
    ).resolves.not.toBeNull();
  });

  it("frees an attempt that was given back", async () => {
    const slots = [];
    for (let i = 0; i < RULE.max; i++) {
      slots.push(await takeAttempt(RULE, "1.1.1.1"));
    }
    await giveBackAttempt(slots[0]!);
    await expect(takeAttempt(RULE, "1.1.1.1")).resolves.not.toBeNull();
  });

  it("starts over in the next window", async () => {
    for (let i = 0; i < RULE.max; i++) await takeAttempt(RULE, "1.1.1.1");
    await expect(takeAttempt(RULE, "1.1.1.1")).resolves.toBeNull();

    vi.useFakeTimers({ now: Date.now() + RULE.windowMs, toFake: ["Date"] });
    try {
      await expect(takeAttempt(RULE, "1.1.1.1")).resolves.not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores neither the address nor a slot that outlives its window", async () => {
    await takeAttempt(RULE, "1.1.1.1");
    const slot = (await RateLimit.findOne().lean())!;

    expect(slot._id).not.toContain("1.1.1.1");
    expect(slot.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      RULE.windowMs,
    );
  });

  it("has a TTL index on expiresAt", async () => {
    const indexes = await RateLimit.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
      }),
    );
  });
});

describe("takeUserAttempt", () => {
  const USER_RULE = { name: "user-test", max: 4, windowMs: 60_000 };

  // createdAt is immutable in Mongoose, so an older account is written through the driver.
  async function createUser(nickname: string, ageMs: number) {
    const { insertedId } = await User.collection.insertOne({
      nickname,
      passwordHash: "x",
      createdAt: new Date(Date.now() - ageMs),
    });
    return insertedId.toString();
  }

  async function allowed(userId: string) {
    let count = 0;
    while ((await takeUserAttempt(USER_RULE, userId)) !== null) count++;
    return count;
  }

  it("gives an account older than 24 hours the whole limit", async () => {
    const userId = await createUser("Old", 25 * 60 * 60 * 1000);
    await expect(allowed(userId)).resolves.toBe(USER_RULE.max);
  });

  it("gives an account younger than 24 hours half of the limit", async () => {
    const userId = await createUser("Young", 23 * 60 * 60 * 1000);
    await expect(allowed(userId)).resolves.toBe(USER_RULE.max / 2);
  });

  it("rounds half of an odd limit down", async () => {
    const userId = await createUser("Young", 0);
    let count = 0;
    while ((await takeUserAttempt({ ...USER_RULE, max: 5 }, userId)) !== null) {
      count++;
    }
    expect(count).toBe(2);
  });

  it("counts every account separately", async () => {
    const first = await createUser("First", 25 * 60 * 60 * 1000);
    const second = await createUser("Second", 25 * 60 * 60 * 1000);
    await allowed(first);
    await expect(takeUserAttempt(USER_RULE, second)).resolves.not.toBeNull();
  });

  it("names every social rule differently", () => {
    const names = Object.values(SOCIAL_LIMITS).map((rule) => rule.name);
    expect(new Set(names).size).toBe(names.length);
    expect(SOCIAL_LIMITS.commentMinute.max).toBe(10);
    expect(SOCIAL_LIMITS.commentDay.max).toBe(200);
    for (const name of [
      "react",
      "rate",
      "follow",
      "block",
      "suggest",
      "library",
    ] as const) {
      expect(SOCIAL_LIMITS[name]).toMatchObject({ max: 60, windowMs: 60_000 });
    }
  });
});
