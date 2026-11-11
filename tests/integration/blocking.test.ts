import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  startConversation,
  sendMessage,
} from "@/app/[locale]/(protected)/messages/actions";
import {
  acceptModeratorInvite,
  inviteModerator,
} from "@/app/[locale]/(protected)/moderation/actions";
import { suggestNicknames } from "@/app/[locale]/mention-actions";
import { follow } from "@/app/[locale]/p/[nickname]/actions";
import {
  blockUser,
  listBlockedUsers,
  unblockUser,
} from "@/app/[locale]/p/[nickname]/block-actions";
import {
  addComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { rate } from "@/app/[locale]/p/[nickname]/[folder]/rating-actions";
import { react } from "@/app/[locale]/p/[nickname]/[folder]/reaction-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Conversation } from "@/lib/models/conversation";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Notification } from "@/lib/models/notification";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { getPublicProfile, listFollows } from "@/lib/profiles/queries";
import { getCommentThread } from "@/lib/social/comments";
import { pairKeyOf } from "@/lib/social/direct-messages";
import { listNotifications } from "@/lib/social/notification-list";
import { isAuthorVisibleTo, moderationRole } from "@/lib/social/permissions";
import { getReactionSummaries } from "@/lib/social/reaction-summary";
import en from "@/messages/en.json";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const error = (code: string, key: keyof typeof en.errors) => ({
  ok: false,
  error: code,
  message: en.errors[key],
});
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");

type Name = "Alice" | "Dave" | "Erin";
const ids = {} as Record<Name, Types.ObjectId>;
const books = {} as Record<Name, { folderId: string; storyId: string }>;

async function createUser(nickname: Name) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
  });
  return insertedId;
}

async function seedBook(userId: Types.ObjectId) {
  const folder = await Folder.create({ userId, name: "Book", published: true });
  const chapter = await Story.create({
    userId,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id.toString(), storyId: chapter._id.toString() };
}

function signInAs(name: Name | null) {
  vi.mocked(requireUser).mockResolvedValue(
    name
      ? { ok: true, userId: ids[name].toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

async function as<T>(name: Name, action: () => Promise<T>): Promise<T> {
  signInAs(name);
  return action();
}

async function ok<T extends { ok: boolean }>(promise: Promise<T>) {
  const result = await promise;
  expect(result).toMatchObject({ ok: true });
  return result as Extract<T, { ok: true }>;
}

beforeEach(async () => {
  for (const name of ["Alice", "Dave", "Erin"] as const) {
    ids[name] = await createUser(name);
    books[name] = await seedBook(ids[name]);
  }
});

// Criterion 1: every interaction of D80, by either side, under a block either way.
describe.each([
  { blocker: "Alice", blocked: "Dave", actor: "Dave", target: "Alice" },
  { blocker: "Alice", blocked: "Dave", actor: "Alice", target: "Dave" },
  { blocker: "Dave", blocked: "Alice", actor: "Dave", target: "Alice" },
  { blocker: "Dave", blocked: "Alice", actor: "Alice", target: "Dave" },
] as const)(
  "$blocker blocks $blocked, $actor acts on $target",
  ({ blocker, blocked, actor, target }) => {
    // The actor who blocked the author does not see the author's texts: NOT_FOUND (76–78).
    const actorBlocks = actor === blocker;
    let targetComment: string;
    let erinReply: string;
    let conversationId: string;

    beforeEach(async () => {
      targetComment = (
        await ok(
          as(target, () => addComment({ storyId: books.Erin.storyId }, "hi")),
        )
      ).id;
      erinReply = (
        await ok(as("Erin", () => replyToComment(targetComment, "hello")))
      ).id;
      conversationId = (
        await ok(as(actor, () => startConversation(target, "before")))
      ).id;
      await ok(as(blocker, () => blockUser(blocked)));
      signInAs(actor);
    });

    it("comments on the target's text", async () => {
      expect(await addComment({ storyId: books[target].storyId }, "x")).toEqual(
        actorBlocks ? error("NOT_FOUND", "commentTargetNotFound") : REFUSED,
      );
      expect(
        await addComment({ folderId: books[target].folderId }, "x"),
      ).toEqual(
        actorBlocks ? error("NOT_FOUND", "commentTargetNotFound") : REFUSED,
      );
    });

    it("replies to the target's comment and in the target's thread", async () => {
      expect(await replyToComment(targetComment, "x")).toEqual(REFUSED);
      expect(await replyToComment(erinReply, "x")).toEqual(REFUSED);
    });

    it("reacts to the target's text and comment", async () => {
      expect(await react("story", books[target].storyId, "heart")).toEqual(
        actorBlocks ? error("NOT_FOUND", "reactionTargetNotFound") : REFUSED,
      );
      expect(await react("comment", targetComment, "heart")).toEqual(
        actorBlocks ? error("NOT_FOUND", "reactionTargetNotFound") : REFUSED,
      );
    });

    it("rates the target's chapter and book", async () => {
      const expected = actorBlocks
        ? error("NOT_FOUND", "ratingTargetNotFound")
        : REFUSED;
      expect(await rate("story", books[target].storyId, 5)).toEqual(expected);
      expect(await rate("folder", books[target].folderId, 5)).toEqual(expected);
    });

    it("mentions the target without a notification", async () => {
      await ok(addComment({ storyId: books.Erin.storyId }, `@${target} look`));
      await flushAfter();
      expect(
        await Notification.countDocuments({
          userId: ids[target],
          type: "mention",
        }),
      ).toBe(0);
      const thread = await getCommentThread(
        ids.Erin.toString(),
        books.Erin,
        null,
      );
      const mention = thread.comments.find(({ body }) => body?.startsWith("@"));
      expect(mention?.mentions).toEqual([]);
    });

    it("writes a direct message to the target", async () => {
      expect(await startConversation(target, "x")).toEqual(REFUSED);
      expect(await sendMessage(conversationId, "x")).toEqual(REFUSED);
    });

    it("follows the target", async () => {
      expect(await follow(target)).toEqual(REFUSED);
      expect(await Follow.countDocuments()).toBe(0);
    });
  },
);

describe("blockUser and unblockUser", () => {
  it("removes follows both ways and closes the conversation (4)", async () => {
    await ok(as("Dave", () => follow("Alice")));
    await ok(as("Alice", () => follow("Dave")));
    await ok(as("Erin", () => follow("Alice")));
    await ok(as("Dave", () => startConversation("Alice", "hi")));

    expect(await as("Alice", () => blockUser("dave"))).toEqual({
      ok: true,
      blocked: true,
    });
    expect(
      await Follow.find({}, { _id: 0, followerId: 1, followeeId: 1 }).lean(),
    ).toEqual([{ followerId: ids.Erin, followeeId: ids.Alice }]);
    const conversation = await Conversation.findOne({
      pairKey: pairKeyOf(ids.Alice, ids.Dave),
    }).lean();
    expect(conversation?.closedAt).toBeInstanceOf(Date);
  });

  it("unblocking restores interaction without the follows and reopens (4)", async () => {
    await ok(as("Dave", () => follow("Alice")));
    await ok(as("Dave", () => startConversation("Alice", "hi")));
    await ok(as("Alice", () => blockUser("Dave")));

    expect(await as("Alice", () => unblockUser("Dave"))).toEqual({
      ok: true,
      blocked: false,
    });
    expect(await Block.countDocuments()).toBe(0);
    expect(await Follow.countDocuments()).toBe(0);
    const conversation = await Conversation.findOne({
      pairKey: pairKeyOf(ids.Alice, ids.Dave),
    }).lean();
    expect(conversation?.closedAt).toBeNull();
    signInAs("Dave");
    await ok(addComment({ storyId: books.Alice.storyId }, "back"));
    await ok(follow("Alice"));
    await ok(startConversation("Alice", "again"));
  });

  it("keeps the conversation closed while the other side still blocks (4)", async () => {
    await ok(as("Dave", () => startConversation("Alice", "hi")));
    await ok(as("Alice", () => blockUser("Dave")));
    await ok(as("Dave", () => blockUser("Alice")));
    await ok(as("Alice", () => unblockUser("Dave")));
    const conversation = await Conversation.findOne({
      pairKey: pairKeyOf(ids.Alice, ids.Dave),
    }).lean();
    expect(conversation?.closedAt).toBeInstanceOf(Date);
    expect(await as("Alice", () => startConversation("Dave", "x"))).toEqual(
      REFUSED,
    );
  });

  it("finishes the steps of an interrupted block when repeated", async () => {
    await ok(as("Dave", () => startConversation("Alice", "hi")));
    await Block.create({ blockerId: ids.Alice, blockedId: ids.Dave });
    await Follow.create({ followerId: ids.Dave, followeeId: ids.Alice });

    await ok(as("Alice", () => blockUser("Dave")));
    expect(await Block.countDocuments()).toBe(1);
    expect(await Follow.countDocuments()).toBe(0);
    const conversation = await Conversation.findOne({
      pairKey: pairKeyOf(ids.Alice, ids.Dave),
    }).lean();
    expect(conversation?.closedAt).toBeInstanceOf(Date);
  });

  it("saves one block when two requests race", async () => {
    signInAs("Alice");
    await Promise.all([
      blockUser("Dave"),
      blockUser("Dave"),
      blockUser("Dave"),
    ]);
    expect(await Block.countDocuments()).toBe(1);
  });

  it("refuses oneself, unknown nicknames, bad input and guests", async () => {
    signInAs("Alice");
    expect(await blockUser("alice")).toEqual(REFUSED);
    expect(await blockUser("nobody")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await unblockUser("nobody")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await blockUser(42 as never)).toEqual(
      error("INVALID_INPUT", "requestInvalid"),
    );
    signInAs(null);
    expect(await blockUser("Dave")).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Signed out",
    });
    expect(await listBlockedUsers()).toMatchObject({ ok: false });
    expect(await Block.countDocuments()).toBe(0);
  });

  it("allows 60 blocks and unblocks a minute, then refuses", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const minute = Date.now() - (Date.now() % 60_000) + 1000;
    vi.setSystemTime(minute);
    signInAs("Alice");
    try {
      for (let i = 0; i < 30; i++) {
        await ok(blockUser("Dave"));
        await ok(unblockUser("Dave"));
      }
      expect(await blockUser("Dave")).toEqual(
        error("RATE_LIMITED", "tooManyAttempts"),
      );
      expect(await Block.countDocuments()).toBe(0);
      vi.setSystemTime(minute + 60_000);
      await ok(blockUser("Dave"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("lists the viewer's own blocks, newest first (5)", async () => {
    signInAs("Alice");
    await ok(blockUser("Dave"));
    await ok(blockUser("Erin"));
    await ok(as("Dave", () => blockUser("Erin")));
    expect(await as("Alice", () => listBlockedUsers())).toEqual({
      ok: true,
      nicknames: ["Erin", "Dave"],
      total: 2,
    });
    await ok(unblockUser("Erin"));
    expect(await listBlockedUsers()).toEqual({
      ok: true,
      nicknames: ["Dave"],
      total: 1,
    });
  });

  it("hides Follow on the profile under a block either way", async () => {
    await ok(as("Alice", () => blockUser("Dave")));
    expect(await getPublicProfile("Dave", ids.Alice.toString())).toMatchObject({
      blocking: true,
      blockedEitherWay: true,
    });
    expect(await getPublicProfile("Alice", ids.Dave.toString())).toMatchObject({
      blocking: false,
      blockedEitherWay: true,
    });
    expect(await getPublicProfile("Alice", ids.Erin.toString())).toMatchObject({
      blocking: false,
      blockedEitherWay: false,
    });
    expect(await getPublicProfile("Alice", null)).toMatchObject({
      blocking: null,
    });
  });
});

describe("moderation roles", () => {
  it.each([
    { blocker: "Alice", blocked: "Dave", state: "active", action: "remove" },
    { blocker: "Alice", blocked: "Dave", state: "invited", action: "remove" },
    { blocker: "Dave", blocked: "Alice", state: "active", action: "resign" },
    { blocker: "Dave", blocked: "Alice", state: "invited", action: "decline" },
  ] as const)(
    "$blocker blocking $blocked ends the $state role with $action",
    async ({ blocker, blocked, state, action }) => {
      await CommunityModerator.create({
        authorId: ids.Alice,
        userId: ids.Dave,
        state,
      });
      await CommunityModerator.create({
        authorId: ids.Alice,
        userId: ids.Erin,
        state: "active",
      });
      await ok(as(blocker, () => blockUser(blocked)));
      expect(
        await CommunityModerator.find({}, { _id: 0, userId: 1 }).lean(),
      ).toEqual([{ userId: ids.Erin }]);
      expect(
        await moderationRole(ids.Dave.toString(), ids.Alice.toString()),
      ).toBeNull();
      expect(
        await ModerationLog.find(
          {},
          { _id: 0, authorId: 1, actorId: 1, action: 1, targetUserId: 1 },
        ).lean(),
      ).toEqual([
        {
          authorId: ids.Alice,
          actorId: ids[blocker],
          action,
          targetUserId: ids.Dave,
        },
      ]);
      await flushAfter();
      expect(await Notification.countDocuments()).toBe(0);
    },
  );

  it("ends the role in the other author's community as well", async () => {
    await CommunityModerator.create({
      authorId: ids.Dave,
      userId: ids.Alice,
      state: "active",
    });
    await ok(as("Alice", () => blockUser("Dave")));
    expect(await CommunityModerator.countDocuments()).toBe(0);
    expect(await ModerationLog.findOne().lean()).toMatchObject({
      authorId: ids.Dave,
      actorId: ids.Alice,
      action: "resign",
    });
  });
});

// A block saved between the permission check and the insert (blockUser's cleanup ran first).
describe("a block racing an insert", () => {
  const blockDaveFirst = () =>
    Block.create({ blockerId: ids.Alice, blockedId: ids.Dave });

  it("follow removes its edge and notifies no one", async () => {
    const save = Follow.updateOne.bind(Follow);
    const spy = vi
      .spyOn(Follow, "updateOne")
      .mockImplementationOnce(((...args: Parameters<typeof save>) =>
        blockDaveFirst().then(() => save(...args))) as never);
    expect(await as("Dave", () => follow("Alice"))).toEqual(REFUSED);
    spy.mockRestore();
    expect(await Follow.countDocuments()).toBe(0);
    await flushAfter();
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("acceptModeratorInvite ends the relation", async () => {
    await CommunityModerator.create({
      authorId: ids.Alice,
      userId: ids.Dave,
      state: "invited",
    });
    const save = CommunityModerator.updateOne.bind(CommunityModerator);
    const spy = vi
      .spyOn(CommunityModerator, "updateOne")
      .mockImplementationOnce(((...args: Parameters<typeof save>) =>
        blockDaveFirst().then(() => save(...args))) as never);
    expect(
      await as("Dave", () => acceptModeratorInvite(ids.Alice.toString())),
    ).toEqual(REFUSED);
    spy.mockRestore();
    expect(await CommunityModerator.countDocuments()).toBe(0);
    expect(await ModerationLog.countDocuments()).toBe(0);
    await flushAfter();
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("inviteModerator withdraws the invitation", async () => {
    await Folder.updateOne(
      { _id: books.Alice.folderId },
      { $set: { published: true } },
    );
    const save = CommunityModerator.create.bind(CommunityModerator);
    const spy = vi
      .spyOn(CommunityModerator, "create")
      .mockImplementationOnce(((...args: Parameters<typeof save>) =>
        blockDaveFirst().then(() => save(...args))) as never);
    expect(await as("Alice", () => inviteModerator("Dave"))).toEqual(REFUSED);
    spy.mockRestore();
    expect(await CommunityModerator.countDocuments()).toBe(0);
    expect(await ModerationLog.countDocuments()).toBe(0);
    await flushAfter();
    expect(await Notification.countDocuments()).toBe(0);
  });
});

// Criterion 2: the blocker sees nothing social of the blocked account.
describe("what the blocker sees", () => {
  it("hides comments, reactions, notifications, suggestions and follow lists", async () => {
    await ok(as("Erin", () => follow("Dave")));
    await ok(as("Erin", () => follow("Alice")));
    await ok(as("Dave", () => follow("Erin")));
    signInAs("Dave");
    await ok(addComment({ storyId: books.Alice.storyId }, "from dave"));
    await ok(react("story", books.Alice.storyId, "heart"));
    await ok(as("Erin", () => react("story", books.Alice.storyId, "heart")));
    await flushAfter();
    expect(
      (await listNotifications(ids.Alice.toString())).some(({ actors }) =>
        actors.includes("Dave"),
      ),
    ).toBe(true);

    await ok(as("Alice", () => blockUser("Dave")));
    const alice = ids.Alice.toString();
    const thread = await getCommentThread(alice, books.Alice, null);
    expect(thread.comments).toEqual([]);
    expect(thread.total).toBe(0);
    const reactions = await getReactionSummaries(alice, "story", [
      books.Alice.storyId,
    ]);
    expect(JSON.stringify([...reactions.values()])).not.toContain("Dave");
    expect(JSON.stringify([...reactions.values()])).toContain("Erin");
    expect(
      (await listNotifications(alice)).some(({ actors }) =>
        actors.includes("Dave"),
      ),
    ).toBe(false);
    expect(await as("Alice", () => suggestNicknames("D"))).toEqual({
      ok: true,
      nicknames: [],
    });
    const followers = await listFollows(ids.Erin, "following", alice, 1);
    expect(JSON.stringify(followers)).not.toContain("Dave");
    expect(JSON.stringify(followers)).toContain("Alice");
    const followersOfErin = await listFollows(ids.Erin, "followers", alice, 1);
    expect(JSON.stringify(followersOfErin)).not.toContain("Dave");

    // Criterion 3: the blocked account still reads the blocker's public texts.
    expect(await isAuthorVisibleTo(ids.Dave.toString(), ids.Alice)).toBe(true);
    expect(await isAuthorVisibleTo(alice, ids.Dave)).toBe(false);
  });
});
