import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

const folderId = new Types.ObjectId();

const DUPLICATE_KEY = { code: 11000 };

describe("Story indexes", () => {
  const alice = new Types.ObjectId();
  const bob = new Types.ObjectId();

  it("allows the same title in another folder of the same user", async () => {
    await Story.create({ folderId, userId: alice, title: "Title" });
    await expect(
      Story.create({
        folderId: new Types.ObjectId(),
        userId: alice,
        title: "Title",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a second active story with the same folder and title", async () => {
    await Story.create({ folderId, userId: alice, title: "Title" });
    await expect(
      Story.create({ folderId, userId: alice, title: "Title" }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it("allows the same title for another user", async () => {
    await Story.create({ folderId, userId: alice, title: "Title" });
    await expect(
      Story.create({ folderId, userId: bob, title: "Title" }),
    ).resolves.toBeDefined();
  });

  it("allows reusing the title of a deleted story", async () => {
    await Story.create({
      folderId,
      userId: alice,
      title: "Title",
      deletedAt: new Date(),
    });
    await expect(
      Story.create({ folderId, userId: alice, title: "Title" }),
    ).resolves.toBeDefined();
  });

  it("treats titles differing in case as distinct", async () => {
    await Story.create({ folderId, userId: alice, title: "Title" });
    await expect(
      Story.create({ folderId, userId: alice, title: "title" }),
    ).resolves.toBeDefined();
  });

  it("allows many stories without shareToken and rejects a duplicate token", async () => {
    await Story.create({ folderId, userId: alice, title: "A" });
    await Story.create({ folderId, userId: alice, title: "B" });
    await Story.create({
      folderId,
      userId: bob,
      title: "C",
      shareToken: "token-1234567890ab",
    });
    await expect(
      Story.create({
        folderId,
        userId: alice,
        title: "D",
        shareToken: "token-1234567890ab",
      }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
  });

  it("stores deletedAt as null on a new document", async () => {
    const { _id } = await Story.create({
      folderId,
      userId: alice,
      title: "Title",
    });
    const raw = await Story.collection.findOne({ _id });
    expect(raw).toHaveProperty("deletedAt", null);
  });
});

describe("Folder", () => {
  const alice = new Types.ObjectId();

  it("rejects a duplicate active name and allows the name of a deleted folder", async () => {
    await Folder.create({
      userId: alice,
      name: "Drafts",
      deletedAt: new Date(),
    });
    await Folder.create({ userId: alice, name: "Drafts" });
    await expect(
      Folder.create({ userId: alice, name: "Drafts" }),
    ).rejects.toMatchObject(DUPLICATE_KEY);
    await expect(
      Folder.create({ userId: new Types.ObjectId(), name: "Drafts" }),
    ).resolves.toBeDefined();
  });

  it("stores defaults for notes, timestamps and deletedAt", async () => {
    const { _id } = await Folder.create({ userId: alice, name: "Drafts" });
    const raw = await Folder.collection.findOne({ _id });
    expect(raw).toMatchObject({ notes: "", deletedAt: null });
    expect(raw?.notesUpdatedAt).toBeInstanceOf(Date);
    expect(raw?.lastActivityAt).toBeInstanceOf(Date);
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
          key: { userId: 1, folderId: 1, title: 1 },
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
