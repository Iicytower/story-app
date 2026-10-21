import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import * as folders002 from "@/migrations/002-folders";
import * as positions003 from "@/migrations/003-positions";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;
const run = () =>
  runMigrations(mongoose.connection, [folders002, positions003], () => {});

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Documents as the 02 deployment writes them: no positions or sort modes.
async function insertFolder(userId: Types.ObjectId, lastActivityAt: Date) {
  const { insertedId } = await db()
    .collection("folders")
    .insertOne({
      userId,
      name: `Folder ${lastActivityAt.toISOString()}`,
      notes: "",
      lastActivityAt,
      deletedAt: null,
    });
  return insertedId;
}

async function insertStory(folderId: Types.ObjectId, createdAt: Date) {
  const { insertedId } = await db()
    .collection("stories")
    .insertOne({
      userId: alice,
      folderId,
      title: `Story ${createdAt.toISOString()}`,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  return insertedId;
}

const positionOf = async (collection: string, _id: Types.ObjectId) =>
  (await db().collection(collection).findOne({ _id }))?.position;

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
  for (const { name } of await db().listCollections().toArray()) {
    if (name.includes("_backup_")) await db().dropCollection(name);
  }
});

describe("003-positions", () => {
  it("numbers folders by activity and chapters by creation, newest first", async () => {
    const older = await insertFolder(alice, day(1));
    const newer = await insertFolder(alice, day(2));
    const bobs = await insertFolder(bob, day(1));
    const first = await insertStory(older, day(1));
    const second = await insertStory(older, day(2));
    const other = await insertStory(newer, day(1));

    await run();

    expect(await positionOf("folders", newer)).toBe(0);
    expect(await positionOf("folders", older)).toBe(1);
    expect(await positionOf("folders", bobs)).toBe(0);
    expect(await positionOf("stories", second)).toBe(0);
    expect(await positionOf("stories", first)).toBe(1);
    expect(await positionOf("stories", other)).toBe(0);
  });

  it("sets default chapter sort modes and leaves users alone", async () => {
    const { insertedId: user } = await db()
      .collection("users")
      .insertOne({ email: "a@example.com", passwordHash: "x" });
    const folder = await insertFolder(alice, day(1));

    await run();

    expect(await db().collection("users").findOne({ _id: user })).toEqual({
      _id: user,
      email: "a@example.com",
      passwordHash: "x",
    });
    expect(
      await db().collection("folders").findOne({ _id: folder }),
    ).toMatchObject({ chapterSort: "created", manualChapterOrder: false });
  });

  it("appends documents created after the first run and keeps existing ones", async () => {
    const folder = await insertFolder(alice, day(1));
    const story = await insertStory(folder, day(1));
    await run();
    await db()
      .collection("folders")
      .updateOne({ _id: folder }, { $set: { chapterSort: "alpha" } });

    const lateFolder = await insertFolder(alice, day(5));
    const lateStory = await insertStory(folder, day(5));
    await run();

    expect(await positionOf("folders", folder)).toBe(0);
    expect(await positionOf("folders", lateFolder)).toBe(1);
    expect(await positionOf("stories", story)).toBe(0);
    expect(await positionOf("stories", lateStory)).toBe(1);
    expect(
      await db().collection("folders").findOne({ _id: folder }),
    ).toMatchObject({ chapterSort: "alpha" });
  });

  it("positions v1.0 stories that 002 moves to Unsorted in the same run", async () => {
    const { insertedId } = await db()
      .collection("stories")
      .insertOne({
        userId: alice,
        title: "Old",
        deletedAt: null,
        createdAt: day(1),
        updatedAt: day(1),
      });

    await run();

    const story = await db().collection("stories").findOne({ _id: insertedId });
    expect(story).toMatchObject({ position: 0 });
    expect(
      await db().collection("folders").findOne({ _id: story!.folderId }),
    ).toMatchObject({ name: "Unsorted", position: 0, chapterSort: "created" });
  });
});
