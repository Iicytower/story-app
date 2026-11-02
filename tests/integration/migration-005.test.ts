import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import * as tags005 from "@/migrations/005-tags";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;
const run = () => runMigrations(mongoose.connection, [tags005], () => {});

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
  for (const { name } of await db().listCollections().toArray()) {
    if (name.includes("_backup_")) await db().dropCollection(name);
  }
});

describe("005-tags", () => {
  it("fills missing tags, keeps existing ones and leaves dates alone", async () => {
    const updatedAt = new Date("2026-01-01");
    const stories = db().collection("stories");
    const folders = db().collection("folders");
    const { insertedId: bare } = await stories.insertOne({
      userId: new Types.ObjectId(),
      title: "Old",
      updatedAt,
    });
    const { insertedId: tagged } = await stories.insertOne({
      userId: new Types.ObjectId(),
      title: "Tagged",
      tags: ["kept"],
    });
    const { insertedId: folder } = await folders.insertOne({ name: "Old" });

    await run();

    const story = await stories.findOne({ _id: bare });
    expect(story?.tags).toEqual([]);
    expect(story?.updatedAt).toEqual(updatedAt);
    expect((await stories.findOne({ _id: tagged }))?.tags).toEqual(["kept"]);
    expect((await folders.findOne({ _id: folder }))?.tags).toEqual([]);
  });

  it("runs again for documents written by the old deployment during the build", async () => {
    await run();
    const { insertedId } = await db()
      .collection("folders")
      .insertOne({ name: "Late" });

    await run();

    expect(
      (await db().collection("folders").findOne({ _id: insertedId }))?.tags,
    ).toEqual([]);
  });
});
