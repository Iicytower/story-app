import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import { ForumCategory } from "@/lib/models/forum-category";
import { listForumCategories } from "@/lib/social/forums";
import * as forum008 from "@/migrations/008-forum-categories";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
});

describe("008-forum-categories", () => {
  it("seeds the five categories in order with labels in both languages (1)", async () => {
    await runMigrations(mongoose.connection, [forum008], () => {});

    const categories = await listForumCategories();
    expect(categories.map(({ key }) => key)).toEqual([
      "announcements",
      "workshop",
      "feedback",
      "recommendations",
      "hyde-park",
    ]);
    expect(categories[0]).toMatchObject({
      labels: { en: "Announcements", pl: "Ogłoszenia" },
      adminOnly: true,
    });
    expect(categories.filter(({ adminOnly }) => adminOnly)).toHaveLength(1);
    for (const { labels } of categories) {
      expect(labels.en).not.toBe("");
      expect(labels.pl).not.toBe("");
    }
  });

  it("keeps changes and adds nothing twice when run again (1)", async () => {
    await forum008.up(db());
    await ForumCategory.updateOne(
      { _id: "workshop" },
      { $set: { "labels.en": "Workshop", order: 9 } },
    );
    await ForumCategory.deleteOne({ _id: "hyde-park" });

    await forum008.up(db());

    expect(await ForumCategory.countDocuments()).toBe(5);
    expect(await ForumCategory.findById("workshop").lean()).toMatchObject({
      labels: { en: "Workshop", pl: "Warsztat pisarski" },
      order: 9,
    });
  });
});
