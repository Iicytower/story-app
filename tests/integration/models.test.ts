import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

const DUPLICATE_KEY = { code: 11000 };

describe("Story indexes", () => {
  const alice = new Types.ObjectId();
  const bob = new Types.ObjectId();

  it("rejects a second active story with the same userId and title", async () => {
    await Story.create({ userId: alice, title: "Title" });
    await expect(
      Story.create({ userId: alice, title: "Title" }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it("allows the same title for another user", async () => {
    await Story.create({ userId: alice, title: "Title" });
    await expect(
      Story.create({ userId: bob, title: "Title" }),
    ).resolves.toBeDefined();
  });

  it("allows reusing the title of a deleted story", async () => {
    await Story.create({
      userId: alice,
      title: "Title",
      deletedAt: new Date(),
    });
    await expect(
      Story.create({ userId: alice, title: "Title" }),
    ).resolves.toBeDefined();
  });

  it("treats titles differing in case as distinct", async () => {
    await Story.create({ userId: alice, title: "Title" });
    await expect(
      Story.create({ userId: alice, title: "title" }),
    ).resolves.toBeDefined();
  });

  it("allows many stories without shareToken and rejects a duplicate token", async () => {
    await Story.create({ userId: alice, title: "A" });
    await Story.create({ userId: alice, title: "B" });
    await Story.create({
      userId: bob,
      title: "C",
      shareToken: "token-1234567890ab",
    });
    await expect(
      Story.create({
        userId: alice,
        title: "D",
        shareToken: "token-1234567890ab",
      }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it("stores deletedAt as null on a new document", async () => {
    const { _id } = await Story.create({ userId: alice, title: "Title" });
    const raw = await Story.collection.findOne({ _id });
    expect(raw).toHaveProperty("deletedAt", null);
  });
});

describe("User", () => {
  it("stores email lowercase and rejects a duplicate email", async () => {
    const user = await User.create({
      email: "Alice@Example.com",
      passwordHash: "x",
    });
    expect(user.email).toBe("alice@example.com");
    await expect(
      User.create({ email: "ALICE@example.com", passwordHash: "y" }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });
});

describe("Story index definitions", () => {
  it("creates partial unique indexes with $type filters", async () => {
    const indexes = await Story.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { userId: 1, title: 1 },
          unique: true,
          partialFilterExpression: { deletedAt: { $type: "null" } },
        }),
        expect.objectContaining({ key: { userId: 1, updatedAt: -1 } }),
        expect.objectContaining({
          key: { shareToken: 1 },
          unique: true,
          partialFilterExpression: { shareToken: { $type: "string" } },
        }),
      ]),
    );
  });
});
