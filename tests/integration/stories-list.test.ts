import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Story } from "@/lib/models/story";
import { listStories } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

async function createStory(
  fields: { title: string; content?: string; deletedAt?: Date },
  updatedAt: Date,
  userId = alice,
) {
  const { _id } = await Story.create({ userId, notes: "secret", ...fields });
  await Story.collection.updateOne({ _id }, { $set: { updatedAt } });
}

const titles = (stories: { title: string }[]) => stories.map((s) => s.title);

describe("listStories", () => {
  it("sorts by updatedAt descending", async () => {
    await createStory({ title: "Old" }, new Date("2026-01-01"));
    await createStory({ title: "New" }, new Date("2026-03-01"));
    await createStory({ title: "Mid" }, new Date("2026-02-01"));

    expect(titles(await listStories(alice.toString()))).toEqual([
      "New",
      "Mid",
      "Old",
    ]);
  });

  it("skips deleted stories and stories of other users", async () => {
    await createStory({ title: "Mine" }, new Date());
    await createStory({ title: "Deleted", deletedAt: new Date() }, new Date());
    await createStory({ title: "Bob's" }, new Date(), bob);

    expect(titles(await listStories(alice.toString()))).toEqual(["Mine"]);
    expect(titles(await listStories(alice.toString(), "e"))).toEqual(["Mine"]);
  });

  it("searches title and content case-insensitively", async () => {
    await createStory({ title: "The DRAGON" }, new Date("2026-01-02"));
    await createStory(
      { title: "Other", content: "a small Dragon" },
      new Date("2026-01-01"),
    );
    await createStory({ title: "None", content: "cat" }, new Date());

    expect(titles(await listStories(alice.toString(), "dragon"))).toEqual([
      "The DRAGON",
      "Other",
    ]);
  });

  it("treats regex metacharacters literally", async () => {
    await createStory({ title: "Plain", content: "abc" }, new Date());
    await createStory({ title: "Paren", content: "x ( y" }, new Date());
    await createStory({ title: "Star", content: "a.*b" }, new Date());

    expect(titles(await listStories(alice.toString(), "("))).toEqual(["Paren"]);
    expect(titles(await listStories(alice.toString(), ".*"))).toEqual(["Star"]);
  });

  it("does not return notes", async () => {
    await createStory({ title: "T", content: "c" }, new Date());

    const [story] = await listStories(alice.toString());
    expect(story).not.toHaveProperty("notes");
    expect(story).toMatchObject({ title: "T", content: "c" });
    expect(typeof story.id).toBe("string");
  });
});
