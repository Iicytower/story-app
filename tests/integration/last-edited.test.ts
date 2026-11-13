import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { getLastEditedChapter } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const MINUTE = 60_000;

async function seedChapter(
  userId: Types.ObjectId,
  folderId: Types.ObjectId,
  title: string,
  minutesAgo: number,
) {
  const story = await Story.create({ userId, folderId, title });
  // timestamps: true would overwrite updatedAt on create.
  await Story.collection.updateOne(
    { _id: story._id },
    { $set: { updatedAt: new Date(Date.now() - minutesAgo * MINUTE) } },
  );
  return story._id.toString();
}

describe("getLastEditedChapter", () => {
  it("returns the user's chapter changed last, with its book", async () => {
    const book = await Folder.create({ userId: alice, name: "Saga" });
    const other = await Folder.create({ userId: alice, name: "Notes" });
    await seedChapter(alice, book._id, "Old", 30);
    const latest = await seedChapter(alice, other._id, "Latest", 5);
    await seedChapter(alice, book._id, "Middle", 10);

    expect(await getLastEditedChapter(alice.toString())).toEqual({
      id: latest,
      title: "Latest",
      bookName: "Notes",
    });
  });

  it("ignores other users' chapters", async () => {
    const mine = await Folder.create({ userId: alice, name: "Mine" });
    const theirs = await Folder.create({ userId: bob, name: "Theirs" });
    const own = await seedChapter(alice, mine._id, "Own", 20);
    await seedChapter(bob, theirs._id, "Bob's", 1);

    expect((await getLastEditedChapter(alice.toString()))?.id).toBe(own);
    expect((await getLastEditedChapter(bob.toString()))?.title).toBe("Bob's");
  });

  it("skips deleted chapters and chapters in deleted books", async () => {
    const live = await Folder.create({ userId: alice, name: "Live" });
    const gone = await Folder.create({
      userId: alice,
      name: "Gone",
      deletedAt: new Date(),
    });
    const kept = await seedChapter(alice, live._id, "Kept", 30);
    const deleted = await seedChapter(alice, live._id, "Deleted", 1);
    await Story.updateOne(
      { _id: deleted },
      { $set: { deletedAt: new Date() } },
    );
    // Not marked deleted itself: only the book is.
    await seedChapter(alice, gone._id, "In deleted book", 2);

    expect((await getLastEditedChapter(alice.toString()))?.id).toBe(kept);
  });

  it("is null without chapters", async () => {
    await Folder.create({ userId: alice, name: "Empty" });
    expect(await getLastEditedChapter(alice.toString())).toBeNull();
    expect(await getLastEditedChapter(bob.toString())).toBeNull();
  });
});
