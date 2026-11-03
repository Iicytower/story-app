import { describe, expect, it, vi } from "vitest";
import { RateLimit } from "@/lib/models/rate-limit";
import { giveBackAttempt, takeAttempt } from "@/lib/rate-limit";
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
