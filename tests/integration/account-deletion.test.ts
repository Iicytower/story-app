import mongoose, { Types } from "mongoose";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "@/app/[locale]/(protected)/actions";
import { recoverAccount } from "@/app/[locale]/auth/recover-actions";
import { register } from "@/app/[locale]/auth/register-actions";
import {
  createPost,
  createThread,
  quotePost,
} from "@/app/[locale]/forums/actions";
import { addComment } from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { react } from "@/app/[locale]/p/[nickname]/[folder]/reaction-actions";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { signOut } from "@/auth";
import { CLEANUP_LEASE_MS, resumeAccountCleanup } from "@/lib/account-deletion";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/auth/session";
import { createSession, isSessionActive } from "@/lib/auth/sessions";
import { Activity } from "@/lib/models/activity";
import { Avatar } from "@/lib/models/avatar";
import { Block } from "@/lib/models/block";
import { ChapterContent } from "@/lib/models/chapter-content";
import { Comment } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Conversation } from "@/lib/models/conversation";
import { Cover } from "@/lib/models/cover";
import { DailyStat } from "@/lib/models/daily-stat";
import { Folder } from "@/lib/models/folder";
import { FolderVersion } from "@/lib/models/folder-version";
import { Follow } from "@/lib/models/follow";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import { LibraryItem } from "@/lib/models/library-item";
import { Message } from "@/lib/models/message";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Notification } from "@/lib/models/notification";
import { Profile } from "@/lib/models/profile";
import { Ranking } from "@/lib/models/ranking";
import { Rating } from "@/lib/models/rating";
import { RateLimit } from "@/lib/models/rate-limit";
import { Reaction } from "@/lib/models/reaction";
import { ReadEvent } from "@/lib/models/read-event";
import { ReaderMark } from "@/lib/models/reader-mark";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Report } from "@/lib/models/report";
import { AuthSession } from "@/lib/models/session";
import { Settings } from "@/lib/models/settings";
import { Shelf } from "@/lib/models/shelf";
import { Story } from "@/lib/models/story";
import { ThreadFollow } from "@/lib/models/thread-follow";
import { User } from "@/lib/models/user";
import { CHANGE_PASSWORD_LIMIT } from "@/lib/rate-limit";
import { getCommentThread } from "@/lib/social/comments";
import { listConversations } from "@/lib/social/direct-messages";
import { getThread } from "@/lib/social/forums";
import { findNicknameSuggestions } from "@/lib/social/mentions";
import { getPublicProfile } from "@/lib/profiles/queries";
import en from "@/messages/en.json";
import * as forum008 from "@/migrations/008-forum-categories";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));

// bcrypt takes seconds when every test file runs in parallel.
vi.setConfig({ testTimeout: 60_000 });

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = "Correct-horse-12345";
const error = (code: string, key: keyof typeof en.errors) => ({
  ok: false,
  error: code,
  message: en.errors[key],
});

let alice: Types.ObjectId;
let bob: Types.ObjectId;
let recoveryCodes: string[];

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

async function ok<T extends { ok: boolean }>(promise: Promise<T>) {
  const result = await promise;
  expect(result).toMatchObject({ ok: true });
  return result as Extract<T, { ok: true }>;
}

async function seedBook(userId: Types.ObjectId, name = "Book") {
  const folder = await Folder.create({ userId, name, published: true });
  const chapter = await Story.create({
    userId,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id, storyId: chapter._id };
}

beforeEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never);
  const registered = await register("Alice", PASSWORD, PASSWORD);
  if (!registered.ok) throw new Error(registered.message);
  recoveryCodes = registered.recoveryCodes;
  alice = (await User.findOne({ nickname: "Alice" }).lean())!._id;
  // Old enough for the full anti-spam limits.
  await User.updateOne(
    { _id: alice },
    { $set: { createdAt: new Date(Date.now() - 2 * DAY) } },
  );
  ({ insertedId: bob } = await User.collection.insertOne({
    nickname: "Bob",
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
  }));
  signInAs(alice);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteAccount – confirmation (criterion 1)", () => {
  it("refuses a wrong password and keeps the account", async () => {
    await expect(
      deleteAccount("Wrong-password-12345", "Alice"),
    ).resolves.toEqual(error("INVALID_INPUT", "currentPasswordIncorrect"));
    expect((await User.findById(alice).lean())!.deletedAt).toBeUndefined();
  });

  it("refuses a nickname that is not the account's, without taking an attempt", async () => {
    await expect(deleteAccount(PASSWORD, "Bob")).resolves.toEqual(
      error("INVALID_INPUT", "deleteAccountNicknameMismatch"),
    );
    await expect(RateLimit.countDocuments()).resolves.toBe(0);
    expect((await User.findById(alice).lean())!.deletedAt).toBeUndefined();
  });

  it("accepts the nickname in any case", async () => {
    await expect(deleteAccount(PASSWORD, " alice ")).resolves.toEqual({
      ok: true,
    });
    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ redirectTo: "/en" });
  });

  it("counts wrong passwords against the limit of changing the password", async () => {
    for (let i = 0; i < CHANGE_PASSWORD_LIMIT.max; i++) {
      await deleteAccount("Wrong-password-12345", "Alice");
    }
    await expect(deleteAccount(PASSWORD, "Alice")).resolves.toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
    expect((await User.findById(alice).lean())!.deletedAt).toBeUndefined();
  });

  it("rejects input of a wrong type and a missing session", async () => {
    await expect(deleteAccount(1, "Alice")).resolves.toEqual(
      error("INVALID_INPUT", "deleteAccountInvalid"),
    );
    signInAs(null);
    await expect(deleteAccount(PASSWORD, "Alice")).resolves.toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });
});

describe("deleteAccount – the tombstone (criteria 2 and 4)", () => {
  it("leaves a tombstone nobody signs in to, recovers or registers again", async () => {
    await ok(deleteAccount(PASSWORD, "Alice"));
    await flushAfter();

    const tombstone = await User.findById(alice).lean();
    expect(tombstone).toMatchObject({ nickname: "Alice" });
    expect(tombstone!.deletedAt).toBeInstanceOf(Date);
    expect(tombstone!.passwordHash).toBeUndefined();
    expect(tombstone!.recoveryCodes).toBeUndefined();
    expect(tombstone!.cleanupPendingAt).toBeUndefined();

    await expect(
      authorizeCredentials({ nickname: "Alice", password: PASSWORD }),
    ).resolves.toBeNull();
    await expect(
      recoverAccount("Alice", recoveryCodes[0], PASSWORD, PASSWORD),
    ).resolves.toEqual(error("INVALID_INPUT", "recoveryInvalid"));
    await expect(register("alice", PASSWORD, PASSWORD)).resolves.toEqual(
      error("DUPLICATE_NAME", "nicknameTaken"),
    );
    await expect(User.countDocuments({ nickname: /^alice$/i })).resolves.toBe(
      1,
    );
    await expect(getPublicProfile("Alice", null)).resolves.toBeNull();
    await expect(getPublicProfile("Alice", bob.toString())).resolves.toBeNull();
  });

  it("ends every session of the account", async () => {
    const sessions = await Promise.all([
      createSession(alice.toString()),
      createSession(alice.toString()),
    ]);
    const bobSession = await createSession(bob.toString());
    await expect(isSessionActive(sessions[1], alice.toString())).resolves.toBe(
      true,
    );

    await ok(deleteAccount(PASSWORD, "Alice"));

    for (const id of sessions) {
      await expect(isSessionActive(id, alice.toString())).resolves.toBe(false);
    }
    await expect(AuthSession.countDocuments({ userId: alice })).resolves.toBe(
      0,
    );
    await expect(isSessionActive(bobSession, bob.toString())).resolves.toBe(
      true,
    );
  });

  it("drops the global ban and the admin role", async () => {
    await User.updateOne(
      { _id: alice },
      {
        $set: {
          role: "admin",
          globalBan: { until: null, reason: "spam", by: bob, at: new Date() },
        },
      },
    );
    await ok(deleteAccount(PASSWORD, "Alice"));
    const tombstone = await User.findById(alice).lean();
    expect(tombstone!.role).toBeUndefined();
    expect(tombstone!.globalBan).toBeUndefined();
  });
});

// Everything of the account and of the other side (Bob), so the test sees what goes and what stays.
async function seedEverything() {
  await forum008.up(mongoose.connection.db!);
  const own = await seedBook(alice);
  const binned = await Folder.create({
    userId: alice,
    name: "Binned",
    deletedAt: new Date(),
  });
  const bobs = await seedBook(bob);
  const content = await ChapterContent.create({
    _id: "content-a",
    userId: alice,
    storyId: own.storyId,
    title: "One",
    content: "text",
    usedAt: new Date(),
  });
  await FolderVersion.collection.insertOne({
    userId: alice,
    folderId: own.folderId,
    number: 1,
    name: "v1",
    chapters: [{ contentId: content._id, storyId: own.storyId }],
  });
  await Cover.collection.insertOne({ userId: alice, folderId: own.folderId });
  await Avatar.collection.insertOne({ userId: alice });
  await Profile.collection.insertOne({ userId: alice, bio: "hi" });
  await Settings.collection.insertOne({
    userId: alice,
    proofreading: { dictionary: ["słowo"] },
  });
  await Follow.collection.insertMany([
    { followerId: alice, followeeId: bob },
    { followerId: bob, followeeId: alice },
  ]);
  const shelf = await Shelf.collection.insertOne({ userId: alice, name: "S" });
  await LibraryItem.collection.insertMany([
    { userId: alice, folderId: bobs.folderId, shelfIds: [shelf.insertedId] },
    { userId: bob, folderId: own.folderId, shelfIds: [] },
  ]);
  await ReadingProgress.collection.insertMany([
    { userId: alice, folderId: bobs.folderId, readStoryIds: [bobs.storyId] },
    { userId: bob, folderId: own.folderId, readStoryIds: [own.storyId] },
  ]);
  await ReaderMark.collection.insertMany([
    { userId: alice, storyId: bobs.storyId, folderId: bobs.folderId },
    { userId: bob, storyId: own.storyId, folderId: own.folderId },
  ]);
  const ratingOf = (
    userId: Types.ObjectId,
    book: typeof own,
    authorId: Types.ObjectId,
  ) => ({
    userId,
    targetType: "folder",
    targetId: book.folderId,
    authorId,
    folderId: book.folderId,
    storyId: null,
    value: 5,
  });
  await Rating.collection.insertMany([
    ratingOf(alice, bobs, bob),
    ratingOf(bob, own, alice),
  ]);
  await Reaction.collection.insertMany([
    {
      userId: alice,
      targetType: "story",
      targetId: bobs.storyId,
      authorId: bob,
      folderId: bobs.folderId,
      storyId: bobs.storyId,
      reaction: "heart",
    },
    {
      userId: bob,
      targetType: "story",
      targetId: own.storyId,
      authorId: alice,
      folderId: own.folderId,
      storyId: own.storyId,
      reaction: "heart",
    },
  ]);
  await Block.collection.insertMany([
    { blockerId: alice, blockedId: new Types.ObjectId() },
    { blockerId: new Types.ObjectId(), blockedId: alice },
  ]);
  await CommunityModerator.collection.insertMany([
    { authorId: alice, userId: new Types.ObjectId(), state: "active" },
    { authorId: bob, userId: alice, state: "active" },
  ]);
  await ForumCategory.updateOne(
    { _id: "workshop" },
    { $set: { moderatorIds: [alice, bob] } },
  );
  await ReadEvent.collection.insertMany([
    {
      storyId: bobs.storyId,
      folderId: bobs.folderId,
      day: "2026-11-10",
      reader: `u:${alice}`,
      expiresAt: new Date(Date.now() + DAY),
    },
    {
      storyId: own.storyId,
      folderId: own.folderId,
      day: "2026-11-10",
      reader: `u:${bob}`,
      expiresAt: new Date(Date.now() + DAY),
    },
  ]);
  await DailyStat.collection.insertOne({
    storyId: own.storyId,
    folderId: own.folderId,
    authorId: alice,
    day: "2026-11-10",
    reads: 1,
  });
  await Ranking.collection.insertOne({
    _id: "weekly" as never,
    items: [{ folderId: own.folderId }, { folderId: bobs.folderId }],
  });
  await Activity.collection.insertOne({
    actorId: alice,
    type: "chapterPublished",
    folderId: own.folderId,
    storyIds: [own.storyId],
    createdAt: new Date(),
  });

  // Comments: Alice's under Bob's chapter stay, Bob's under Alice's go with her chapter.
  signInAs(alice);
  const aliceComment = (
    await ok(addComment({ storyId: bobs.storyId.toString() }, "Alice was here"))
  ).id;
  signInAs(bob);
  await ok(addComment({ storyId: own.storyId.toString() }, "Bob on Alice"));

  // Forums: Alice's own forum goes; her posts in a global thread stay.
  signInAs(alice);
  const ownThread = (
    await ok(createThread({ nickname: "Alice" }, "Mine", "First"))
  ).id;
  const globalThread = (
    await ok(createThread({ category: "workshop" }, "Global", "Alice first"))
  ).id;
  const alicePost = (await ok(createPost(globalThread, "Alice reply"))).id;
  signInAs(bob);
  await ok(createPost(ownThread, "Bob in Alice's forum"));
  await ok(quotePost(alicePost, "Bob quotes Alice"));

  // After the comments and posts: Bob's ban would refuse them.
  await CommunityBan.collection.insertMany([
    { authorId: alice, userId: new Types.ObjectId(), until: null, by: alice },
    { authorId: bob, userId: alice, until: null, by: bob },
  ]);
  // Direct messages of both sides.
  const conversation = await Conversation.create({
    participantIds: [alice, bob].sort((a, b) =>
      a.toString().localeCompare(b.toString()),
    ),
    pairKey: [alice, bob].map(String).sort().join(":"),
    lastMessageAt: new Date(),
  });
  await Message.collection.insertMany([
    { conversationId: conversation._id, senderId: alice, body: "hi" },
    { conversationId: conversation._id, senderId: bob, body: "hello" },
  ]);
  await Notification.collection.insertMany([
    {
      userId: alice,
      type: "follower",
      group: "social",
      objectKey: "a",
      actorIds: [bob],
      updatedAt: new Date(),
    },
    {
      userId: bob,
      type: "follower",
      group: "social",
      objectKey: "only-alice",
      actorIds: [alice],
      updatedAt: new Date(),
    },
    {
      userId: bob,
      type: "reaction",
      group: "social",
      objectKey: "alice-and-other",
      actorIds: [alice, new Types.ObjectId()],
      updatedAt: new Date(),
    },
    {
      userId: bob,
      type: "mention",
      group: "social",
      objectKey: "dm",
      actorIds: [new Types.ObjectId()],
      conversationId: conversation._id,
      updatedAt: new Date(),
    },
  ]);

  // Reports: by Alice, of Alice's comment, and to Alice's community.
  await Report.collection.insertMany([
    { reporterId: alice, targetUserId: bob, route: "admin", state: "open" },
    {
      reporterId: bob,
      targetUserId: alice,
      targetType: "comment",
      targetId: new Types.ObjectId(aliceComment),
      route: "admin",
      state: "open",
    },
    {
      reporterId: bob,
      targetUserId: bob,
      route: "author",
      authorId: alice,
      state: "open",
    },
  ]);
  await ModerationLog.collection.insertMany([
    { authorId: alice, actorId: alice, action: "hide", targetUserId: bob },
    { authorId: null, actorId: bob, action: "ban", targetUserId: alice },
  ]);
  signInAs(alice);
  return {
    own,
    binned,
    bobs,
    globalThread,
    ownThread,
    aliceComment,
    conversation,
  };
}

describe("deleteAccount – the data (criterion 3)", () => {
  it("removes the account's data and keeps its comments and posts as a deleted user's", async () => {
    const seeded = await seedEverything();

    await ok(deleteAccount(PASSWORD, "Alice"));
    await flushAfter();

    const a = alice;
    const empty = {
      folders: Folder.countDocuments({ userId: a }),
      stories: Story.countDocuments({ userId: a }),
      versions: FolderVersion.countDocuments({ userId: a }),
      contents: ChapterContent.countDocuments({ userId: a }),
      covers: Cover.countDocuments({ userId: a }),
      avatars: Avatar.countDocuments({ userId: a }),
      profiles: Profile.countDocuments({ userId: a }),
      settings: Settings.countDocuments({ userId: a }),
      follows: Follow.countDocuments({
        $or: [{ followerId: a }, { followeeId: a }],
      }),
      shelves: Shelf.countDocuments({ userId: a }),
      library: LibraryItem.countDocuments({
        $or: [{ userId: a }, { folderId: seeded.own.folderId }],
      }),
      progress: ReadingProgress.countDocuments({
        $or: [{ userId: a }, { folderId: seeded.own.folderId }],
      }),
      marks: ReaderMark.countDocuments({
        $or: [{ userId: a }, { storyId: seeded.own.storyId }],
      }),
      ratings: Rating.countDocuments({
        $or: [{ userId: a }, { authorId: a }],
      }),
      reactions: Reaction.countDocuments({
        $or: [{ userId: a }, { authorId: a }],
      }),
      blocks: Block.countDocuments({
        $or: [{ blockerId: a }, { blockedId: a }],
      }),
      bans: CommunityBan.countDocuments({
        $or: [{ authorId: a }, { userId: a }],
      }),
      moderators: CommunityModerator.countDocuments({
        $or: [{ authorId: a }, { userId: a }],
      }),
      categoryModerators: ForumCategory.countDocuments({ moderatorIds: a }),
      readEvents: ReadEvent.countDocuments({
        $or: [{ reader: `u:${a}` }, { folderId: seeded.own.folderId }],
      }),
      dailyStats: DailyStat.countDocuments({ authorId: a }),
      rankings: Ranking.countDocuments({
        "items.folderId": seeded.own.folderId,
      }),
      activity: Activity.countDocuments({ actorId: a }),
      threadFollows: ThreadFollow.countDocuments({ userId: a }),
      ownForum: ForumThread.countDocuments({ authorId: a }),
      ownForumPosts: ForumPost.countDocuments({
        threadId: new Types.ObjectId(seeded.ownThread),
      }),
      conversations: Conversation.countDocuments({ participantIds: a }),
      messages: Message.countDocuments({
        conversationId: seeded.conversation._id,
      }),
      notifications: Notification.countDocuments({
        $or: [{ userId: a }, { actorIds: a }, { objectKey: "dm" }],
      }),
      commentsOnHerTexts: Comment.countDocuments({ authorId: a }),
      reportsByHer: Report.countDocuments({ reporterId: a }),
      reportsToHerCommunity: Report.countDocuments({ authorId: a }),
    };
    const counts = Object.fromEntries(
      await Promise.all(
        Object.entries(empty).map(async ([key, count]) => [key, await count]),
      ),
    );
    expect(counts).toEqual(
      Object.fromEntries(Object.keys(empty).map((key) => [key, 0])),
    );

    // What stays: Bob's own data, the moderation log and reports of Alice's content.
    await expect(Folder.countDocuments({ userId: bob })).resolves.toBe(1);
    await expect(LibraryItem.countDocuments()).resolves.toBe(0);
    await expect(
      ForumCategory.findById("workshop").lean(),
    ).resolves.toMatchObject({ moderatorIds: [bob] });
    await expect(
      Notification.findOne({ objectKey: "alice-and-other" }).lean(),
    ).resolves.toMatchObject({ actorIds: [expect.any(Types.ObjectId)] });
    await expect(Ranking.findById("weekly").lean()).resolves.toMatchObject({
      items: [{ folderId: seeded.bobs.folderId }],
    });
    await expect(
      Notification.countDocuments({ objectKey: "only-alice" }),
    ).resolves.toBe(0);
    await expect(ModerationLog.countDocuments()).resolves.toBe(2);
    await expect(Report.countDocuments({ targetUserId: a })).resolves.toBe(1);
    await expect(Comment.countDocuments({ userId: a })).resolves.toBe(1);
    await expect(ForumPost.countDocuments({ userId: a })).resolves.toBe(2);

    const comments = await getCommentThread(
      bob.toString(),
      {
        folderId: seeded.bobs.folderId.toString(),
        storyId: seeded.bobs.storyId.toString(),
      },
      null,
    );
    expect(comments.comments).toEqual([
      expect.objectContaining({
        id: seeded.aliceComment,
        state: "visible",
        author: { nickname: null, avatar: null },
        body: "Alice was here",
        canBan: false,
      }),
    ]);

    const thread = await getThread(bob.toString(), seeded.globalThread);
    expect(thread!.starter).toBeNull();
    expect(
      thread!.posts.map(({ author, body, quote }) => ({ author, body, quote })),
    ).toEqual([
      {
        author: { nickname: null, avatar: null },
        body: "Alice first",
        quote: null,
      },
      {
        author: { nickname: null, avatar: null },
        body: "Alice reply",
        quote: null,
      },
      {
        author: { nickname: "Bob", avatar: null },
        body: "Bob quotes Alice",
        quote: { id: expect.any(String), nickname: null, excerpt: null },
      },
    ]);

    await expect(listConversations(bob.toString())).resolves.toEqual([]);
    signInAs(bob);
    await expect(
      findNicknameSuggestions(bob.toString(), "Ali"),
    ).resolves.toEqual([]);
  });

  it("shows a conversation not yet cleaned up as one with a deleted account", async () => {
    await Conversation.create({
      participantIds: [alice, bob],
      pairKey: [alice, bob].map(String).sort().join(":"),
      lastMessageAt: new Date(),
    });
    await User.updateOne({ _id: alice }, { $set: { deletedAt: new Date() } });
    await expect(listConversations(bob.toString())).resolves.toEqual([
      expect.objectContaining({ nickname: null }),
    ]);
  });
});

describe("content of a deleted account", () => {
  it("takes reactions and reports, notifies nobody and cannot be quoted", async () => {
    await forum008.up(mongoose.connection.db!);
    const bobs = await seedBook(bob);
    const comment = (
      await ok(addComment({ storyId: bobs.storyId.toString() }, "Alice"))
    ).id;
    const thread = (
      await ok(createThread({ category: "workshop" }, "Global", "First"))
    ).id;
    const post = (await ok(createPost(thread, "Alice reply"))).id;
    await User.updateOne({ _id: alice }, { $set: { deletedAt: new Date() } });
    await flushAfter();
    await Notification.deleteMany({});

    signInAs(bob);
    await ok(react("comment", comment, "heart"));
    await ok(react("post", post, "heart"));
    await ok(report("comment", comment, "spam", ""));
    await ok(report("post", post, "spam", ""));
    await expect(quotePost(post, "Quote")).resolves.toEqual(
      error("NOT_FOUND", "postNotFound"),
    );
    await flushAfter();

    await expect(Reaction.countDocuments({ userId: bob })).resolves.toBe(2);
    await expect(
      Report.countDocuments({ reporterId: bob, targetUserId: alice }),
    ).resolves.toBe(2);
    await expect(Notification.countDocuments({ userId: alice })).resolves.toBe(
      0,
    );
  });
});

describe("deleteAccount – an interrupted cleanup (criterion 5)", () => {
  it("is finished by a later request once its lease is over", async () => {
    const seeded = await seedEverything();
    vi.spyOn(Story, "deleteMany").mockRejectedValueOnce(new Error("injected"));

    await ok(deleteAccount(PASSWORD, "Alice"));
    await expect(flushAfter()).rejects.toThrow("injected");

    const stopped = await User.findById(alice).lean();
    expect(stopped!.deletedAt).toBeInstanceOf(Date);
    expect(stopped!.cleanupPendingAt).toBeInstanceOf(Date);
    await expect(Story.countDocuments({ userId: alice })).resolves.toBe(1);
    await expect(Folder.countDocuments({ userId: alice })).resolves.toBe(2);

    // Within the lease nobody takes it over.
    await expect(resumeAccountCleanup()).resolves.toBeNull();

    await User.updateOne(
      { _id: alice },
      {
        $set: {
          cleanupPendingAt: new Date(Date.now() - CLEANUP_LEASE_MS - 1000),
        },
      },
    );
    // Two requests at once: only one takes it over.
    const taken = await Promise.all([
      resumeAccountCleanup(),
      resumeAccountCleanup(),
    ]);
    expect(taken.filter(Boolean)).toEqual([alice.toString()]);

    await expect(Story.countDocuments({ userId: alice })).resolves.toBe(0);
    await expect(Folder.countDocuments({ userId: alice })).resolves.toBe(0);
    await expect(
      ForumThread.countDocuments({ _id: new Types.ObjectId(seeded.ownThread) }),
    ).resolves.toBe(0);
    await expect(Comment.countDocuments({ authorId: alice })).resolves.toBe(0);
    await expect(Comment.countDocuments({ userId: alice })).resolves.toBe(1);
    expect(
      (await User.findById(alice).lean())!.cleanupPendingAt,
    ).toBeUndefined();
    await expect(resumeAccountCleanup()).resolves.toBeNull();
  });
});
