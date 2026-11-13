import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyProfile,
  updateBio,
} from "@/app/[locale]/(protected)/profile/actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_BIO_LENGTH } from "@/lib/limits";
import { Block } from "@/lib/models/block";
import { Cover } from "@/lib/models/cover";
import { Follow } from "@/lib/models/follow";
import { Folder } from "@/lib/models/folder";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import {
  FOLLOWS_PAGE_SIZE,
  getPublicProfile,
  listFollows,
  myAccount,
  myProfilePath,
} from "@/lib/profiles/queries";
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

  it("moves a book named like a profile list off its address", async () => {
    await seedBook("Followers");
    const profile = await getPublicProfile("Alice", null);
    expect(profile?.books.map(({ path }) => path)).toEqual([
      "/p/Alice/followers-2",
    ]);
    expect(await getPublishedFolder("Alice", "followers")).toBeNull();
    expect((await getPublishedFolder("Alice", "followers-2"))?.name).toBe(
      "Followers",
    );
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

  it("gives the sidebar the account's nickname and avatar (task 95)", async () => {
    expect(await myAccount(alice.toString())).toEqual({
      nickname: "Alice",
      avatar: null,
    });
    const avatarId = new Types.ObjectId();
    await Profile.updateOne(
      { userId: alice },
      { avatarId },
      { upsert: true },
    );
    expect(await myAccount(alice.toString())).toEqual({
      nickname: "Alice",
      avatar: `/avatars/${avatarId}`,
    });
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
      createdAt: new Date(),
    });
    expect(await myAccount(insertedId.toString())).toEqual({
      nickname: null,
      avatar: null,
    });
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

describe("followers and following", () => {
  const nicknames = (list: { accounts: { nickname: string }[] }) =>
    list.accounts.map(({ nickname }) => nickname);

  async function follows(
    followerId: Types.ObjectId,
    followeeId: Types.ObjectId,
    at: Date,
  ) {
    await Follow.collection.insertOne({
      followerId,
      followeeId,
      createdAt: at,
    });
  }

  it("counts and lists both sides, newest first, the same for guests and users", async () => {
    const carol = (await User.create({ nickname: "Carol", passwordHash: "x" }))
      ._id;
    await follows(bob, alice, new Date("2026-11-01"));
    await follows(carol, alice, new Date("2026-11-02"));
    await follows(alice, bob, new Date("2026-11-03"));
    await Profile.create({ userId: carol, avatarId: new Types.ObjectId() });

    for (const viewer of [null, bob.toString()]) {
      expect(await getPublicProfile("Alice", viewer)).toMatchObject({
        followers: 2,
        following: 1,
      });
      const followers = await listFollows(alice, "followers", viewer, 1);
      expect(nicknames(followers)).toEqual(["Carol", "Bob"]);
      expect(followers.hasMore).toBe(false);
      expect(followers.accounts[0].avatar).toMatch(/^\/avatars\//);
      expect(followers.accounts[1].avatar).toBeNull();
      expect(
        nicknames(await listFollows(alice, "following", viewer, 1)),
      ).toEqual(["Bob"]);
    }
    expect(await getPublicProfile("Carol", null)).toMatchObject({
      followers: 0,
      following: 1,
    });
  });

  it("tells a signed-in visitor whether they follow, and nobody else", async () => {
    await follows(bob, alice, new Date());
    expect((await getPublicProfile("Alice", bob.toString()))?.followed).toBe(
      true,
    );
    expect((await getPublicProfile("Bob", alice.toString()))?.followed).toBe(
      false,
    );
    expect((await getPublicProfile("Alice", null))?.followed).toBeNull();
    expect(
      (await getPublicProfile("Alice", alice.toString()))?.followed,
    ).toBeNull();
  });

  it("leaves out accounts the viewer blocked and globally banned ones, in lists and counts", async () => {
    const carol = (await User.create({ nickname: "Carol", passwordHash: "x" }))
      ._id;
    const dave = (await User.create({ nickname: "Dave", passwordHash: "x" }))
      ._id;
    await follows(bob, alice, new Date());
    await follows(carol, alice, new Date());
    await follows(alice, carol, new Date());
    await follows(alice, dave, new Date());
    await Block.create({ blockerId: dave, blockedId: carol });
    await User.updateOne(
      { _id: bob },
      { globalBan: { until: null, reason: "spam", by: dave, at: new Date() } },
    );

    expect(await getPublicProfile("Alice", null)).toMatchObject({
      followers: 1,
      following: 2,
    });
    expect(nicknames(await listFollows(alice, "followers", null, 1))).toEqual([
      "Carol",
    ]);
    expect(await getPublicProfile("Alice", dave.toString())).toMatchObject({
      followers: 0,
      following: 1,
    });
    expect(
      nicknames(await listFollows(alice, "followers", dave.toString(), 1)),
    ).toEqual([]);
    expect(
      nicknames(await listFollows(alice, "following", dave.toString(), 1)),
    ).toEqual(["Dave"]);
  });

  it("skips an account that no longer exists", async () => {
    await follows(new Types.ObjectId(), alice, new Date());
    await follows(bob, alice, new Date());
    expect(nicknames(await listFollows(alice, "followers", null, 1))).toEqual([
      "Bob",
    ]);
  });

  it("pages by 50", async () => {
    const base = new Date("2026-11-01").getTime();
    const { insertedIds } = await User.collection.insertMany(
      Array.from({ length: FOLLOWS_PAGE_SIZE + 1 }, (_, i) => ({
        nickname: `Reader${String(i).padStart(2, "0")}`,
        passwordHash: "x",
        createdAt: new Date(),
      })),
    );
    await Follow.collection.insertMany(
      Object.values(insertedIds).map((followerId, i) => ({
        followerId,
        followeeId: alice,
        // Two follows share each second, so the order must not depend on the time alone.
        createdAt: new Date(base + Math.floor(i / 2) * 1000),
      })),
    );
    const first = await listFollows(alice, "followers", null, 1);
    const second = await listFollows(alice, "followers", null, 2);
    expect(first.accounts).toHaveLength(FOLLOWS_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(nicknames(first)[0]).toBe("Reader50");
    expect(nicknames(second)).toEqual(["Reader00"]);
    expect(second.hasMore).toBe(false);
    expect(new Set([...nicknames(first), ...nicknames(second)]).size).toBe(
      FOLLOWS_PAGE_SIZE + 1,
    );
    expect((await getPublicProfile("Alice", null))?.followers).toBe(
      FOLLOWS_PAGE_SIZE + 1,
    );
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
