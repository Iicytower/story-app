import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { User } from "@/lib/models/user";
import { purgeSocialData } from "@/lib/social/cascade";
import {
  canInteract,
  hiddenUserIdsFor,
  isAuthorVisibleTo,
  isModeratorOf,
} from "@/lib/social/permissions";
import { setupTestDb } from "./test-db";

setupTestDb();

const HOUR = 60 * 60 * 1000;
const FORBIDDEN = {
  ok: false,
  error: "FORBIDDEN",
  key: "interactionNotAllowed",
};

async function createUser(nickname: string) {
  const user = await User.create({ nickname, passwordHash: "x" });
  return user._id.toString();
}

async function users() {
  const author = await createUser("Author");
  const reader = await createUser("Reader");
  return { author, reader };
}

function ban(authorId: string, userId: string, until: Date | null) {
  return CommunityBan.create({
    authorId,
    userId,
    until,
    reason: "Spam",
    by: authorId,
  });
}

function globalBan(userId: string, until: Date | null) {
  return User.updateOne(
    { _id: userId },
    {
      $set: {
        globalBan: {
          until,
          reason: "Spam",
          by: new Types.ObjectId(),
          at: new Date(),
        },
      },
    },
  );
}

describe("canInteract", () => {
  it("allows without any relation", async () => {
    const { author, reader } = await users();
    await expect(
      canInteract(reader, { authorId: author, kind: "comment" }),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses under an active global ban and allows after it expires", async () => {
    const { author, reader } = await users();
    await globalBan(reader, null);
    await expect(
      canInteract(reader, { authorId: author, kind: "dm" }),
    ).resolves.toEqual(FORBIDDEN);

    await globalBan(reader, new Date(Date.now() + HOUR));
    await expect(
      canInteract(reader, { authorId: author, kind: "comment" }),
    ).resolves.toEqual(FORBIDDEN);

    await globalBan(reader, new Date(Date.now() - HOUR));
    await expect(
      canInteract(reader, { authorId: author, kind: "comment" }),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses under an active community ban and allows after it expires", async () => {
    const { author, reader } = await users();
    await ban(author, reader, new Date(Date.now() + HOUR));
    await expect(
      canInteract(reader, { authorId: author, kind: "react" }),
    ).resolves.toEqual(FORBIDDEN);
    await expect(
      canInteract(reader, { authorId: author, kind: "follow" }),
    ).resolves.toEqual({ ok: true });

    vi.useFakeTimers({ now: Date.now() + 2 * HOUR, toFake: ["Date"] });
    try {
      await expect(
        canInteract(reader, { authorId: author, kind: "react" }),
      ).resolves.toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the community ban only in that author's community", async () => {
    const { author, reader } = await users();
    const other = await createUser("Other");
    await ban(author, reader, null);
    await expect(
      canInteract(reader, { authorId: other, kind: "comment" }),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses across a block in both directions", async () => {
    const { author, reader } = await users();
    await Block.create({ blockerId: author, blockedId: reader });
    for (const [actor, target] of [
      [reader, author],
      [author, reader],
    ]) {
      await expect(
        canInteract(actor, { authorId: target, kind: "comment" }),
      ).resolves.toEqual(FORBIDDEN);
      await expect(
        canInteract(actor, { authorId: target, kind: "dm" }),
      ).resolves.toEqual(FORBIDDEN);
    }

    await Block.deleteMany({});
    await expect(
      canInteract(reader, { authorId: author, kind: "comment" }),
    ).resolves.toEqual({ ok: true });
  });

  it("does not find a missing author", async () => {
    const { reader } = await users();
    const missing = { ok: false, error: "NOT_FOUND", key: "userNotFound" };
    await expect(
      canInteract(reader, {
        authorId: new Types.ObjectId().toString(),
        kind: "comment",
      }),
    ).resolves.toEqual(missing);
    await expect(
      canInteract(reader, { authorId: "not-an-id", kind: "comment" }),
    ).resolves.toEqual(missing);
  });

  it("allows acting on one's own content", async () => {
    const { author } = await users();
    await expect(
      canInteract(author, { authorId: author, kind: "comment" }),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses one's own content under one's own global ban", async () => {
    const { author } = await users();
    await globalBan(author, null);
    await expect(
      canInteract(author, { authorId: author, kind: "comment" }),
    ).resolves.toEqual(FORBIDDEN);
  });
});

describe("isModeratorOf", () => {
  it("counts only an accepted invitation in that community", async () => {
    const { author, reader } = await users();
    await CommunityModerator.create({
      authorId: author,
      userId: reader,
      state: "invited",
    });
    await expect(isModeratorOf(reader, author)).resolves.toBe(false);

    await CommunityModerator.updateOne({}, { $set: { state: "active" } });
    await expect(isModeratorOf(reader, author)).resolves.toBe(true);
    await expect(isModeratorOf(author, reader)).resolves.toBe(false);
  });
});

describe("hiddenUserIdsFor", () => {
  it("hides accounts the viewer blocked and active global bans", async () => {
    const { author, reader } = await users();
    const blocked = await createUser("Blocked");
    const banned = await createUser("Banned");
    const expired = await createUser("Expired");
    const blockedByOther = await createUser("BlockedByOther");
    await Block.create({ blockerId: reader, blockedId: blocked });
    await Block.create({ blockerId: author, blockedId: blockedByOther });
    await globalBan(banned, null);
    await globalBan(expired, new Date(Date.now() - HOUR));

    const hidden = await hiddenUserIdsFor(reader);
    expect(hidden.map(String).sort()).toEqual([blocked, banned].sort());
    expect(hidden[0]).toBeInstanceOf(Types.ObjectId);

    const forGuest = await hiddenUserIdsFor(null);
    expect(forGuest.map(String)).toEqual([banned]);
  });

  it("does not hide a globally banned viewer from themselves", async () => {
    const { reader } = await users();
    await globalBan(reader, null);
    await expect(hiddenUserIdsFor(reader)).resolves.toEqual([]);
  });
});

describe("isAuthorVisibleTo", () => {
  it("agrees with hiddenUserIdsFor for every viewer and author", async () => {
    const { author, reader } = await users();
    const blocked = await createUser("Blocked");
    const blocker = await createUser("Blocker");
    const banned = await createUser("Banned");
    const expired = await createUser("Expired");
    const temporary = await createUser("Temporary");
    await Block.create({ blockerId: reader, blockedId: blocked });
    await Block.create({ blockerId: blocker, blockedId: reader });
    await globalBan(banned, null);
    await globalBan(expired, new Date(Date.now() - HOUR));
    await globalBan(temporary, new Date(Date.now() + HOUR));
    const everyone = [
      author,
      reader,
      blocked,
      blocker,
      banned,
      expired,
      temporary,
    ];

    for (const viewer of everyone) {
      const hidden = new Set((await hiddenUserIdsFor(viewer)).map(String));
      for (const target of everyone) {
        expect(
          await isAuthorVisibleTo(viewer, target),
          `${viewer} -> ${target}`,
        ).toBe(!hidden.has(target));
      }
    }
    expect(await isAuthorVisibleTo(reader, blocker)).toBe(true);
    expect(await isAuthorVisibleTo(banned, banned)).toBe(true);
  });

  it("does not show an author without a nickname", async () => {
    const { reader } = await users();
    // Accounts from before task 36 have no nickname.
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
    });
    expect(await isAuthorVisibleTo(reader, insertedId)).toBe(false);
    expect(await isAuthorVisibleTo(reader, new Types.ObjectId())).toBe(false);
  });
});

describe("unique pairs", () => {
  it.each([
    [
      "blocks",
      (a: string, b: string) => Block.create({ blockerId: a, blockedId: b }),
    ],
    ["communityBans", (a: string, b: string) => ban(a, b, null)],
    [
      "communityModerators",
      (a: string, b: string) =>
        CommunityModerator.create({ authorId: a, userId: b, state: "invited" }),
    ],
  ])("%s allows one document per pair", async (_, create) => {
    const { author, reader } = await users();
    await create(author, reader);
    await expect(create(author, reader)).rejects.toMatchObject({
      code: 11000,
    });
    await expect(create(reader, author)).resolves.toBeDefined();
  });
});

describe("purgeSocialData", () => {
  it("runs without social collections to purge yet", async () => {
    await expect(
      purgeSocialData({
        folderIds: [new Types.ObjectId().toString()],
        storyIds: [new Types.ObjectId().toString()],
      }),
    ).resolves.toBeUndefined();
  });
});
