import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import * as publishedAt006 from "@/migrations/006-published-at";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;
const run = () =>
  runMigrations(mongoose.connection, [publishedAt006], () => {});

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
  for (const { name } of await db().listCollections().toArray()) {
    if (name.includes("_backup_")) await db().dropCollection(name);
  }
});

async function seed() {
  const folders = db().collection("folders");
  const stories = db().collection("stories");
  const { insertedId: live } = await folders.insertOne({
    name: "Live",
    published: true,
    deletedAt: null,
  });
  const { insertedId: draft } = await folders.insertOne({
    name: "Draft",
    deletedAt: null,
  });
  const { insertedId: removed } = await folders.insertOne({
    name: "Removed",
    published: true,
    deletedAt: new Date(),
  });
  const updatedAt = new Date("2026-01-01");
  const chapter = (folderId: Types.ObjectId, fields: object = {}) =>
    stories
      .insertOne({
        userId: new Types.ObjectId(),
        folderId,
        title: "Chapter",
        publication: "public",
        deletedAt: null,
        updatedAt,
        ...fields,
      })
      .then(({ insertedId }) => insertedId);
  return {
    updatedAt,
    visible: [await chapter(live), await chapter(live)],
    invisible: [
      await chapter(live, { publication: "hidden" }),
      await chapter(live, { publication: undefined }),
      await chapter(live, { deletedAt: new Date() }),
      await chapter(draft),
      await chapter(removed),
    ],
  };
}

const find = (id: Types.ObjectId) =>
  db().collection("stories").findOne({ _id: id });

describe("006-published-at", () => {
  it("gives visible chapters one date and leaves the others alone", async () => {
    const { visible, invisible, updatedAt } = await seed();
    const before = Date.now();

    await run();

    const [first, second] = await Promise.all(visible.map(find));
    expect(first?.publishedAt).toBeInstanceOf(Date);
    expect(first?.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(second?.publishedAt).toEqual(first?.publishedAt);
    expect(first?.updatedAt).toEqual(updatedAt);
    for (const id of invisible) {
      expect((await find(id))?.publishedAt).toBeUndefined();
    }
  });

  it("keeps existing dates when it runs again", async () => {
    const { visible } = await seed();
    await run();
    const dates = (await Promise.all(visible.map(find))).map(
      (story) => story?.publishedAt,
    );

    await run();

    expect(
      (await Promise.all(visible.map(find))).map((story) => story?.publishedAt),
    ).toEqual(dates);
  });
});
