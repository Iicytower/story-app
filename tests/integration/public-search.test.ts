import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import {
  getPublishedChapter,
  listPublicTags,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import { MAX_RESULTS } from "@/lib/publish/search";
import { setupTestDb } from "./test-db";

setupTestDb();

let alice: Types.ObjectId;

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

function seedChapter(
  folder: { _id: Types.ObjectId; userId: Types.ObjectId },
  fields: Record<string, unknown> = {},
) {
  return Story.create({
    userId: folder.userId,
    folderId: folder._id,
    title: "Rozdział",
    content: "Zielona Łąka w słońcu",
    notes: "tajemnica",
    publication: "public",
    ...fields,
  });
}

const titles = async (query: string, tags: string[] = []) =>
  (await searchPublishedChapters(query, tags)).map(({ title }) => title);

describe("searchPublishedChapters", () => {
  it("finds a chapter by title, folder name, own tag, folder tag and text", async () => {
    const folder = await seedFolder({ tags: ["epika"] });
    await seedChapter(folder, { tags: ["smoki"] });

    for (const query of ["rozdział", "KSIĘGA", "smoki", "EPIKA", "w słońcu"]) {
      expect(await titles(query)).toEqual(["Rozdział"]);
    }
    expect(await titles("nic takiego")).toEqual([]);
  });

  it("lists only the public chapters for a folder name", async () => {
    const folder = await seedFolder();
    await seedChapter(folder, { title: "A" });
    await seedChapter(folder, { title: "B", publication: "hidden" });

    expect(await titles("księga")).toEqual(["A"]);
  });

  it("ignores Polish letter case in the database filter", async () => {
    await seedChapter(await seedFolder());

    expect(await titles("ZIELONA ŁĄKA")).toEqual(["Rozdział"]);
    expect(await titles("zielona łąka")).toEqual(["Rozdział"]);
  });

  it("requires every selected tag, also together with text", async () => {
    const folder = await seedFolder({ tags: ["epika"] });
    await seedChapter(folder, { title: "A", tags: ["smoki"] });
    await seedChapter(folder, { title: "B" });

    expect(await titles("", ["epika", "smoki"])).toEqual(["A"]);
    expect((await titles("", ["epika"])).toSorted()).toEqual(["A", "B"]);
    expect(await titles("łąka", ["smoki"])).toEqual(["A"]);
    expect(await titles("nic", ["epika"])).toEqual([]);
  });

  it("does not search or show comments, notes or folder notes", async () => {
    const folder = await seedFolder();
    await seedChapter(folder, {
      content: "Jawny tekst <!-- sekretnik --> dalej",
    });

    expect(await titles("sekretnik")).toEqual([]);
    expect(await titles("tajemnica")).toEqual([]);
    expect(await titles("tajnotka")).toEqual([]);

    const [result] = await searchPublishedChapters("dalej", []);
    expect(JSON.stringify(result)).not.toContain("sekretnik");
  });

  it("returns only the reader-facing fields", async () => {
    await seedChapter(await seedFolder());

    const [result] = await searchPublishedChapters("łąka", []);
    expect(Object.keys(result).toSorted()).toEqual([
      "adult",
      "folderName",
      "folderTags",
      "nickname",
      "path",
      "snippet",
      "tags",
      "title",
    ]);
    expect(result.nickname).toBe("Alice");
    expect(JSON.stringify(result)).not.toContain(alice.toString());
  });

  it("skips every chapter a reader could not open", async () => {
    const published = await seedFolder();
    await seedChapter(published, { title: "Ukryty", publication: "hidden" });
    await seedChapter(published, {
      title: "Bez decyzji",
      publication: undefined,
    });
    await seedChapter(published, { title: "Usunięty", deletedAt: new Date() });
    await seedChapter(
      await seedFolder({ name: "Prywatny", published: false }),
      {
        title: "W prywatnym",
      },
    );
    await seedChapter(
      await seedFolder({ name: "Stary", deletedAt: new Date() }),
      {
        title: "W usuniętym",
      },
    );
    await seedChapter(published, { title: "Widoczny" });

    expect(await titles("łąka")).toEqual(["Widoczny"]);
  });

  it("leaves out authors without a nickname", async () => {
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
      email: "old@example.com",
    });
    await seedChapter(await seedFolder({ userId: insertedId }));

    expect(await titles("łąka")).toEqual([]);
    expect(await listPublicTags()).toEqual([]);
  });

  it("gives addresses that open, also next to a hidden chapter with the same slug", async () => {
    const folder = await seedFolder();
    await seedChapter(folder, { title: "Ą", publication: "hidden" });
    await seedChapter(folder, { title: "A" });

    const [{ path }] = await searchPublishedChapters("łąka", []);
    expect(path).toBe("/p/Alice/ksiega/a-2");
    const [, , nickname, folderSlug, chapterSlug] = path.split("/");
    const chapter = await getPublishedChapter(
      nickname,
      folderSlug,
      chapterSlug,
    );
    expect(chapter?.title).toBe("A");
  });

  it("caps the results after dropping comment-only hits", async () => {
    const folder = await seedFolder();
    await seedChapter(folder, {
      title: "Komentarz",
      content: "<!-- szukane -->",
    });
    for (let i = 0; i < MAX_RESULTS + 1; i++) {
      await seedChapter(folder, { title: `R${i}`, content: "szukane" });
    }

    const results = await titles("szukane");
    expect(results).toHaveLength(MAX_RESULTS);
    expect(results).not.toContain("Komentarz");
  });
});

describe("listPublicTags", () => {
  it("lists only tags of public chapters and their folders", async () => {
    const folder = await seedFolder({ tags: ["epika"] });
    await seedChapter(folder, { title: "A", tags: ["żółw", "bajka"] });
    await seedChapter(folder, {
      title: "B",
      tags: ["tajny-ukryty"],
      publication: "hidden",
    });
    await seedChapter(folder, {
      title: "C",
      tags: ["tajny-usunięty"],
      deletedAt: new Date(),
    });
    const empty = await seedFolder({ name: "Pusty", tags: ["tajny-folder"] });
    await seedChapter(empty, { publication: "hidden" });
    await seedChapter(
      await seedFolder({ name: "Prywatny", published: false, tags: ["tajny"] }),
    );

    expect(await listPublicTags()).toEqual(["bajka", "epika", "żółw"]);
  });
});
