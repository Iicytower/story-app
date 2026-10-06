import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Story } from "@/lib/models/story";
import { getStory } from "@/lib/stories/queries";
import { setupTestDb } from "./test-db";

setupTestDb();

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();

describe("getStory", () => {
  it("returns the serialized story of its owner", async () => {
    const story = await Story.create({
      userId: alice,
      title: "Mine",
      content: "Body",
      notes: "Note",
    });

    expect(await getStory(alice.toString(), story._id.toString())).toEqual({
      id: story._id.toString(),
      title: "Mine",
      content: "Body",
      notes: "Note",
      updatedAt: story.updatedAt.toISOString(),
    });
  });

  it("returns null for another user's story", async () => {
    const story = await Story.create({ userId: bob, title: "Bob's" });
    expect(await getStory(alice.toString(), story._id.toString())).toBeNull();
  });

  it("returns null for a deleted story", async () => {
    const story = await Story.create({
      userId: alice,
      title: "Gone",
      deletedAt: new Date(),
    });
    expect(await getStory(alice.toString(), story._id.toString())).toBeNull();
  });

  it("returns null for a missing or malformed id", async () => {
    const missing = new Types.ObjectId().toString();
    expect(await getStory(alice.toString(), missing)).toBeNull();
    expect(await getStory(alice.toString(), "not-an-id")).toBeNull();
  });
});
