import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import * as folders002 from "@/migrations/002-folders";
import { setupTestDb } from "./test-db";

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

const run = () => runMigrations(mongoose.connection, [folders002], () => {});

// Stories as v1.0 writes them: without folderId.
async function insertV1Story(
  userId: Types.ObjectId,
  title: string,
  updatedAt = new Date("2026-01-01"),
  deletedAt: Date | null = null,
) {
  const { insertedId } = await Story.collection.insertOne({
    userId,
    title,
    content: "",
    notes: "",
    deletedAt,
    createdAt: updatedAt,
    updatedAt,
  });
  return insertedId;
}

beforeEach(async () => {
  const db = mongoose.connection.db!;
  await db.collection("migrations").deleteMany({});
  for (const { name } of await db.listCollections().toArray()) {
    if (name.includes("_backup_")) await db.dropCollection(name);
  }
});

describe("002-folders", () => {
  it("creates Unsorted per user and assigns all of their stories", async () => {
    await insertV1Story(alice, "A", new Date("2026-01-01"));
    await insertV1Story(alice, "B", new Date("2026-03-01"));
    await insertV1Story(alice, "Deleted", new Date("2026-05-01"), new Date());
    await insertV1Story(bob, "C", new Date("2026-02-01"));

    await run();

    const folders = await Folder.find().sort({ userId: 1 }).lean();
    expect(folders).toHaveLength(2);
    for (const folder of folders) {
      expect(folder).toMatchObject({
        name: "Unsorted",
        notes: "",
        deletedAt: null,
      });
      expect(folder.notesUpdatedAt).toBeInstanceOf(Date);
      expect(folder.createdAt).toBeInstanceOf(Date);
    }
    const aliceFolder = folders.find((f) => f.userId.equals(alice))!;
    // The latest active story, not the deleted one.
    expect(aliceFolder.lastActivityAt).toEqual(new Date("2026-03-01"));

    const stories = await Story.find().lean();
    for (const story of stories) {
      const folder = folders.find((f) => f.userId.equals(story.userId))!;
      expect(story.folderId).toEqual(folder._id);
    }
  });

  it("creates a folder covered by the unique name index", async () => {
    await insertV1Story(alice, "A");
    await run();

    await expect(
      Folder.create({ userId: alice, name: "Unsorted" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("changes nothing on a second run", async () => {
    await insertV1Story(alice, "A");
    await run();
    const folders = await Folder.find().lean();
    const stories = await Story.find().lean();

    await run();

    expect(await Folder.find().lean()).toEqual(folders);
    expect(await Story.find().lean()).toEqual(stories);
  });

  it("assigns a story created by v1.0 after the first run to Unsorted", async () => {
    await insertV1Story(alice, "A");
    await run();
    const late = await insertV1Story(alice, "Late", new Date("2026-06-01"));

    await run();

    const folder = await Folder.findOne({ userId: alice }).lean();
    expect(await Folder.countDocuments()).toBe(1);
    expect((await Story.findById(late).lean())?.folderId).toEqual(folder?._id);
    expect(folder?.lastActivityAt).toEqual(new Date("2026-06-01"));
  });

  it("renames a late story whose title already exists in Unsorted", async () => {
    await insertV1Story(alice, "Twin");
    await run();
    const late = await insertV1Story(alice, "Twin");

    await run();

    expect((await Story.findById(late).lean())?.title).toBe("Twin (2)");
  });

  it("leaves users without stories alone", async () => {
    await run();
    expect(await Folder.countDocuments()).toBe(0);
  });
});
