import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyProfile,
  updateBio,
} from "@/app/[locale]/(protected)/profile/actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_BIO_LENGTH } from "@/lib/limits";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { getPublicProfile, myProfilePath } from "@/lib/profiles/queries";
import { getPublishedFolder } from "@/lib/publish/queries";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
let alice: Types.ObjectId;
let bob: Types.ObjectId;

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

async function seedBook(
  name: string,
  {
    userId = alice,
    published = true,
    deleted = false,
    chapters = ["public"],
    adult = false,
  }: {
    userId?: Types.ObjectId;
    published?: boolean;
    deleted?: boolean;
    chapters?: ("public" | "hidden" | "deleted" | "private")[];
    adult?: boolean;
  } = {},
) {
  const folder = await Folder.create({
    userId,
    name,
    published: published || undefined,
    deletedAt: deleted ? new Date() : null,
    adult: adult ? { manual: true } : undefined,
  });
  for (const [index, kind] of chapters.entries()) {
    await Story.create({
      userId,
      folderId: folder._id,
      title: `${name} ${index + 1}`,
      content: "text",
      publication:
        kind === "private"
          ? undefined
          : kind === "hidden"
            ? "hidden"
            : "public",
      deletedAt: kind === "deleted" ? new Date() : null,
    });
  }
  return folder;
}

beforeEach(async () => {
  alice = (await User.create({ nickname: "Alice", passwordHash: "x" }))._id;
  bob = (await User.create({ nickname: "Bob", passwordHash: "x" }))._id;
  signInAs(alice);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getPublicProfile", () => {
  it("lists only published books with a public chapter, for guests and users alike", async () => {
    await seedBook("Visible");
    await seedBook("Private folder", { published: false });
    await seedBook("Only hidden", { chapters: ["hidden"] });
    await seedBook("Only private", { chapters: ["private"] });
    await seedBook("Only deleted", { chapters: ["deleted"] });
    await seedBook("Deleted folder", { deleted: true });
    await seedBook("Bob's book", { userId: bob });

    for (const viewer of [null, bob.toString(), alice.toString()]) {
      const profile = await getPublicProfile("Alice", viewer);
      expect(profile?.books.map(({ name }) => name)).toEqual(["Visible"]);
    }
  });

  it("links each book to its contents page, with slugs counted over all folders", async () => {
    await seedBook("Księga?", { published: false });
    await seedBook("Księga!", { chapters: ["public", "hidden"] });
    const profile = await getPublicProfile("Alice", null);
    const [book] = profile!.books;
    expect(book.path).toBe("/p/Alice/ksiega-2");
    const folder = await getPublishedFolder("Alice", "ksiega-2");
    expect(folder?.path).toBe(book.path);
    expect(folder?.chapters.map(({ title }) => title)).toEqual(["Księga! 1"]);
  });

  it("marks 18+ books and their 18+ covers", async () => {
    const folder = await seedBook("Night", { adult: true });
    const cover = await Cover.create({
      userId: alice,
      folderId: folder._id,
      data: Buffer.from("x"),
      size: 1,
      state: "rated",
      autoAdult: true,
    });
    await Folder.updateOne({ _id: folder._id }, { coverId: cover._id });
    const profile = await getPublicProfile("Alice", null);
    expect(profile?.books).toEqual([
      {
        name: "Night",
        path: "/p/Alice/night",
        adult: true,
        cover: { path: `/covers/${cover._id}`, adult: true },
      },
    ]);
  });

  it("shows the bio and gives the nickname as stored, whatever case was asked for", async () => {
    await Profile.create({ userId: alice, bio: "**Hi**" });
    const profile = await getPublicProfile("alice", null);
    expect(profile).toMatchObject({
      nickname: "Alice",
      bio: "**Hi**",
      avatar: null,
      books: [],
      owner: false,
    });
  });

  it("does not exist for an unknown nickname or an account without one", async () => {
    expect(await getPublicProfile("Nobody", null)).toBeNull();
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
      createdAt: new Date(),
    });
    expect(await myProfilePath(insertedId.toString())).toBeNull();
    expect(await myProfilePath(alice.toString())).toBe("/p/Alice");
  });

  it("is hidden from others during a global ban, but not from the owner", async () => {
    await User.updateOne(
      { _id: alice },
      {
        globalBan: {
          until: new Date(Date.now() + DAY),
          reason: "spam",
          by: bob,
          at: new Date(),
        },
      },
    );
    expect(await getPublicProfile("Alice", null)).toBeNull();
    expect(await getPublicProfile("Alice", bob.toString())).toBeNull();
    expect(await getPublicProfile("Alice", alice.toString())).toMatchObject({
      owner: true,
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * DAY);
    expect(await getPublicProfile("Alice", null)).not.toBeNull();
  });
});

describe("updateBio", () => {
  it("saves the trimmed bio of the signed-in user", async () => {
    expect(await updateBio("  **Hello** <b>x</b>\n")).toEqual({
      ok: true,
      bio: "**Hello** <b>x</b>",
    });
    expect((await getPublicProfile("Alice", null))?.bio).toBe(
      "**Hello** <b>x</b>",
    );
    expect(await getMyProfile()).toEqual({
      ok: true,
      nickname: "Alice",
      bio: "**Hello** <b>x</b>",
      avatar: null,
    });
    expect(await updateBio("")).toEqual({ ok: true, bio: "" });
    expect(await Profile.countDocuments({ userId: alice })).toBe(1);
  });

  it("rejects a bio over the limit", async () => {
    expect(await updateBio("x".repeat(MAX_BIO_LENGTH))).toMatchObject({
      ok: true,
    });
    expect(await updateBio("x".repeat(MAX_BIO_LENGTH + 1))).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.bioTooLong.replace("{max, number}", "1,000"),
    });
    expect((await getPublicProfile("Alice", null))?.bio).toHaveLength(
      MAX_BIO_LENGTH,
    );
  });

  it("rejects what is not a string", async () => {
    expect(await updateBio({ bio: "x" } as unknown as string)).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.requestInvalid,
    });
  });

  it("changes only the profile of the session's user", async () => {
    await updateBio("Alice's");
    signInAs(bob);
    await updateBio("Bob's");
    expect((await getPublicProfile("Alice", null))?.bio).toBe("Alice's");
    expect((await getPublicProfile("Bob", null))?.bio).toBe("Bob's");
  });

  it("requires a session", async () => {
    signInAs(null);
    expect(await updateBio("x")).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Signed out",
    });
    expect(await getMyProfile()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(await Profile.countDocuments()).toBe(0);
  });
});
