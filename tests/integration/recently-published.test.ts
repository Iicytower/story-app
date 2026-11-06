import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { listRecentlyPublished } from "@/lib/publish/queries";
import { MAX_RECENT } from "@/lib/publish/search";
import { setupTestDb } from "./test-db";

setupTestDb();

let alice: Types.ObjectId;
let at = Date.parse("2026-11-01T00:00:00.000Z");

beforeEach(async () => {
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
});

function seedFolder(fields: Record<string, unknown> = {}) {
  return Folder.create({
    userId: alice,
    name: "Księga",
    published: true,
    notes: "tajnotka",
    ...fields,
  });
}

// Each chapter is published a minute after the previous one unless given a date.
function seedChapter(
  folder: { _id: Types.ObjectId; userId: Types.ObjectId },
  fields: Record<string, unknown> = {},
) {
  at += 60_000;
  return Story.create({
    userId: folder.userId,
    folderId: folder._id,
    title: "Rozdział",
    content: "Zielona Łąka w słońcu",
    notes: "tajemnica",
    publication: "public",
    publishedAt: new Date(at),
    ...fields,
  });
}

const titles = async () =>
  (await listRecentlyPublished()).map(({ title }) => title);

describe("listRecentlyPublished", () => {
  it("lists the newest first, the newer id first on the same date", async () => {
    const folder = await seedFolder();
    const same = new Date("2026-10-01T00:00:00.000Z");
    await seedChapter(folder, { title: "Old A", publishedAt: same });
    await seedChapter(folder, { title: "Old B", publishedAt: same });
    await seedChapter(folder, { title: "New" });

    expect(await titles()).toEqual(["New", "Old B", "Old A"]);
  });

  it(`returns at most ${MAX_RECENT}`, async () => {
    const folder = await seedFolder();
    for (let i = 0; i < MAX_RECENT + 2; i++) {
      await seedChapter(folder, { title: `Chapter ${i}` });
    }

    const list = await titles();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe(`Chapter ${MAX_RECENT + 1}`);
  });

  it("skips every chapter a reader could not open", async () => {
    const published = await seedFolder();
    await seedChapter(published, { title: "Ukryty", publication: "hidden" });
    await seedChapter(published, {
      title: "Bez decyzji",
      publication: undefined,
    });
    await seedChapter(published, { title: "Usunięty", deletedAt: new Date() });
    await seedChapter(published, { title: "Bez daty", publishedAt: undefined });
    await seedChapter(
      await seedFolder({ name: "Prywatny", published: false }),
      { title: "W prywatnym" },
    );
    await seedChapter(
      await seedFolder({ name: "Stary", deletedAt: new Date() }),
      { title: "W usuniętym" },
    );
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
      email: "old@example.com",
    });
    await seedChapter(
      await seedFolder({ userId: insertedId, name: "Bez nicku" }),
      { title: "Bez nicku" },
    );
    await seedChapter(published, { title: "Widoczny" });

    expect(await titles()).toEqual(["Widoczny"]);
  });

  it("shows the start of the text without comments and no private data", async () => {
    const folder = await seedFolder({ tags: ["epika"] });
    await seedChapter(folder, {
      content: "Jawny <!-- sekretnik --> tekst",
      tags: ["smoki"],
    });

    const [chapter] = await listRecentlyPublished();
    expect(chapter).toMatchObject({
      title: "Rozdział",
      folderName: "Księga",
      nickname: "Alice",
      path: "/p/Alice/ksiega/rozdzial",
      tags: ["smoki"],
      folderTags: ["epika"],
      snippet: { before: "Jawny tekst", match: "", after: "" },
      publishedAt: new Date(at),
    });
    const json = JSON.stringify(chapter);
    for (const secret of ["sekretnik", "tajemnica", "tajnotka"]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toContain(alice.toString());
  });
});
