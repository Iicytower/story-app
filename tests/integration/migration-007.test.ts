import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { listPredefinedTags } from "@/lib/tags/queries";
import { validatePredefinedTag } from "@/lib/tags/predefined";
import * as predefined007 from "@/migrations/007-predefined-tags";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
});

describe("007-predefined-tags", () => {
  it("seeds a valid list with a label in every language", async () => {
    await runMigrations(mongoose.connection, [predefined007], () => {});

    const tags = await listPredefinedTags();
    expect(tags.length).toBeGreaterThanOrEqual(20);
    expect(tags).toContainEqual({
      key: "sci-fi",
      labels: { en: "Science fiction", pl: "Fantastyka naukowa" },
    });
    for (const tag of tags) {
      expect(validatePredefinedTag(tag, tags)).toBeNull();
    }
  });

  it("keeps labels changed later and adds nothing twice when run again", async () => {
    await predefined007.up(db());
    const count = await PredefinedTag.countDocuments();
    await PredefinedTag.updateOne(
      { _id: "crime" },
      { $set: { "labels.en": "Crime story" } },
    );

    await predefined007.up(db());

    expect(await PredefinedTag.countDocuments()).toBe(count);
    expect((await PredefinedTag.findById("crime").lean())?.labels.en).toBe(
      "Crime story",
    );
  });
});
