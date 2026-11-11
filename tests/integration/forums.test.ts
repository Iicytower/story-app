import mongoose, { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  banFromCommunity,
  hideContent,
  restoreContent,
} from "@/app/[locale]/(protected)/moderation/actions";
import {
  createPost,
  createThread,
  deletePost,
  editPost,
  followThread,
  type ForumRef,
  quotePost,
  unfollowThread,
} from "@/app/[locale]/forums/actions";
import { blockUser } from "@/app/[locale]/p/[nickname]/block-actions";
import { react } from "@/app/[locale]/p/[nickname]/[folder]/reaction-actions";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { follow } from "@/app/[locale]/p/[nickname]/actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_POST_LENGTH, MAX_THREAD_TITLE_LENGTH } from "@/lib/limits";
import { Activity } from "@/lib/models/activity";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Folder } from "@/lib/models/folder";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Notification } from "@/lib/models/notification";
import { Reaction } from "@/lib/models/reaction";
import { Report } from "@/lib/models/report";
import { Story } from "@/lib/models/story";
import { ThreadFollow } from "@/lib/models/thread-follow";
import { User } from "@/lib/models/user";
import { getFeed } from "@/lib/social/feed";
import {
  findAuthorForum,
  findCategoryPlace,
  getThread,
  listThreads,
  threadReplyRecipients,
} from "@/lib/social/forums";
import { listNotifications } from "@/lib/social/notification-list";
import { getReactionSummaries } from "@/lib/social/reaction-summary";
import en from "@/messages/en.json";
import * as forum008 from "@/migrations/008-forum-categories";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const error = (code: string, key: keyof typeof en.errors, max?: number) => ({
  ok: false,
  error: code,
  message:
    max === undefined
      ? en.errors[key]
      : en.errors[key].replace("{max, number}", max.toLocaleString("en")),
});
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");
const THREAD_NOT_FOUND = error("NOT_FOUND", "threadNotFound");
const POST_NOT_FOUND = error("NOT_FOUND", "postNotFound");

type Name = "Alice" | "Dave" | "Erin" | "Admin" | "Carol" | "Bob";
const ids = {} as Record<Name, Types.ObjectId>;
const NAMES: Name[] = ["Alice", "Dave", "Erin", "Admin", "Carol", "Bob"];

async function createUser(nickname: Name) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
    ...(nickname === "Admin" && { role: "admin" }),
  });
  return insertedId;
}

async function seedBook(userId: Types.ObjectId) {
  const folder = await Folder.create({ userId, name: "Book", published: true });
  await Story.create({
    userId,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
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

const WORKSHOP: ForumRef = { category: "workshop" };
const ALICE_FORUM: ForumRef = { nickname: "Alice" };

async function thread(name: Name, forum = WORKSHOP, title = "Thread") {
  return (await ok(as(name, () => createThread(forum, title, "First")))).id;
}

async function firstPost(threadId: string) {
  const post = await ForumPost.findOne({ threadId })
    .sort({ createdAt: 1 })
    .lean();
  return post!._id.toString();
}

async function post(name: Name, threadId: string, body = "Reply") {
  return (await ok(as(name, () => createPost(threadId, body)))).id;
}

const viewOf = (name: Name | null, threadId: string) =>
  getThread(name ? ids[name].toString() : null, threadId);

beforeEach(async () => {
  await forum008.up(mongoose.connection.db!);
  for (const name of NAMES) ids[name] = await createUser(name);
  await seedBook(ids.Alice);
  await ForumCategory.updateOne(
    { _id: "workshop" },
    { $set: { moderatorIds: [ids.Bob] } },
  );
  await CommunityModerator.create({
    authorId: ids.Alice,
    userId: ids.Carol,
    state: "active",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("threads and posts (2)", () => {
  it("starts a thread in a global category with the first post as its text", async () => {
    const id = await thread("Dave", WORKSHOP, "  Plot holes  ");
    const view = await viewOf("Dave", id);
    expect(view).toMatchObject({
      title: "Plot holes",
      path: `/forums/t/${id}`,
      starter: "Dave",
      followed: true,
      posts: [{ body: "First", author: { nickname: "Dave" }, own: true }],
    });
    const place = (await findCategoryPlace("workshop"))!;
    expect(await listThreads(null, place)).toMatchObject([
      { id, title: "Plot holes", starter: "Dave", postCount: 1 },
    ]);
  });

  it("writes posts and quotes in the thread, keeping only the quoted post's id", async () => {
    const id = await thread("Dave");
    await post("Erin", id, "Agreed");
    const quoted = await firstPost(id);
    const quote = await ok(as("Erin", () => quotePost(quoted, "Me **too**")));
    const saved = await ForumPost.findById(quote.id).lean();
    expect(saved).toMatchObject({
      quotePostId: new Types.ObjectId(quoted),
      body: "Me **too**",
    });
    const view = await viewOf(null, id);
    expect(view!.posts.map(({ body }) => body)).toEqual([
      "First",
      "Agreed",
      "Me **too**",
    ]);
    expect(view!.posts[2].quote).toEqual({
      id: quoted,
      nickname: "Dave",
      excerpt: "First",
    });
    expect(
      await ForumThread.findById(id).select({ postCount: 1 }).lean(),
    ).toMatchObject({ postCount: 3 });
  });

  it("has a forum for an author with a public book only, and records the author's thread", async () => {
    const id = await thread("Dave", ALICE_FORUM);
    expect((await viewOf(null, id))?.path).toBe(`/p/Alice/forum/${id}`);
    expect(await findAuthorForum(null, "erin")).toBeNull();
    expect(
      await as("Dave", () => createThread({ nickname: "Erin" }, "T", "x")),
    ).toEqual(error("NOT_FOUND", "forumNotFound"));
    expect(await Activity.countDocuments()).toBe(0);

    const own = await thread("Alice", ALICE_FORUM, "News");
    expect(await Activity.find().lean()).toMatchObject([
      {
        actorId: ids.Alice,
        type: "forumThread",
        threadId: new Types.ObjectId(own),
      },
    ]);
    await ok(as("Erin", () => follow("Alice")));
    const { entries } = await getFeed(ids.Erin.toString(), null);
    expect(entries).toMatchObject([
      {
        type: "forumThread",
        nickname: "Alice",
        thread: { title: "News", path: `/p/Alice/forum/${own}` },
      },
    ]);
  });

  it("lets only admins write in the announcements", async () => {
    const forum = { category: "announcements" };
    expect(await as("Dave", () => createThread(forum, "T", "x"))).toEqual(
      REFUSED,
    );
    const id = await thread("Admin", forum);
    expect(await as("Dave", () => createPost(id, "x"))).toEqual(REFUSED);
    await post("Admin", id);
  });

  it("checks the session and the input", async () => {
    signInAs(null);
    expect(await createThread(WORKSHOP, "T", "x")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    signInAs("Dave");
    expect(await createThread({ category: "nope" }, "T", "x")).toEqual(
      error("NOT_FOUND", "forumNotFound"),
    );
    expect(await createThread(5 as never, "T", "x")).toEqual(
      error("INVALID_INPUT", "requestInvalid"),
    );
    expect(await createPost("nope", "x")).toEqual(
      error("INVALID_INPUT", "requestInvalid"),
    );
    expect(await createPost(new Types.ObjectId().toString(), "x")).toEqual(
      THREAD_NOT_FOUND,
    );
  });

  it("deletes a post; the thread's first post leaves a placeholder or takes the thread", async () => {
    const id = await thread("Dave");
    const reply = await post("Erin", id);
    await ok(as("Dave", () => react("post", reply, "heart")));
    await ok(as("Erin", () => deletePost(reply)));
    expect(await Reaction.countDocuments()).toBe(0);
    await post("Erin", id);
    const first = await firstPost(id);
    await ok(as("Dave", () => deletePost(first)));
    expect((await viewOf(null, id))!.posts[0]).toMatchObject({
      state: "deleted",
      body: null,
      author: null,
    });

    const alone = await thread("Dave");
    expect(await as("Erin", () => deletePost(alone))).toEqual(POST_NOT_FOUND);
    const only = await firstPost(alone);
    await ok(as("Dave", () => deletePost(only)));
    expect(await viewOf("Dave", alone)).toBeNull();
    expect(await ThreadFollow.countDocuments({ threadId: alone })).toBe(0);

    // The last reply under a deleted first post takes the thread with it.
    const last = await thread("Dave");
    const lastReply = await post("Erin", last);
    const opening = await firstPost(last);
    await ok(as("Dave", () => deletePost(opening)));
    await ok(as("Erin", () => deletePost(lastReply)));
    expect(await viewOf("Erin", last)).toBeNull();
    expect((await ForumThread.findById(last).lean())?.deletedAt).toBeInstanceOf(
      Date,
    );
  });

  it("never sends the text of a quoted post the viewer may not see", async () => {
    const id = await thread("Dave", WORKSHOP);
    const secret = await post("Carol", id, "Carol secret");
    const hidden = await post("Erin", id, "Erin hidden text");
    const gone = await post("Erin", id, "Erin gone text");
    for (const quoted of [secret, hidden, gone]) {
      await ok(as("Dave", () => quotePost(quoted, "Quoting")));
    }
    await ok(as("Admin", () => hideContent("post", hidden)));
    await ok(as("Erin", () => deletePost(gone)));
    await ok(as("Erin", () => blockUser("Carol")));

    const erinView = JSON.stringify(await viewOf("Erin", id));
    expect(erinView).not.toContain("Carol secret");
    const guestView = await viewOf(null, id);
    const guest = JSON.stringify(guestView);
    expect(guest).not.toContain("Erin hidden text");
    expect(guest).not.toContain("Erin gone text");
    expect(
      guestView!.posts.filter(({ quote }) => quote).map(({ quote }) => quote),
    ).toEqual([
      { id: secret, nickname: "Carol", excerpt: "Carol secret" },
      { id: hidden, nickname: null, excerpt: null },
      { id: gone, nickname: null, excerpt: null },
    ]);
    const quotes = (await viewOf("Erin", id))!.posts.flatMap(({ quote }) =>
      quote ? [quote] : [],
    );
    expect(quotes[0]).toEqual({ id: secret, nickname: null, excerpt: null });
  });
});

describe("editing, lengths and limits (3)", () => {
  it("edits within 15 minutes only, and only one's own post", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await thread("Dave");
    const first = await firstPost(id);
    await ok(as("Dave", () => editPost(first, "Better")));
    expect((await viewOf(null, id))!.posts[0]).toMatchObject({
      body: "Better",
      edited: true,
    });
    expect(await as("Erin", () => editPost(first, "x"))).toEqual(
      POST_NOT_FOUND,
    );
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(await as("Dave", () => editPost(first, "Late"))).toEqual(
      error("FORBIDDEN", "postEditExpired"),
    );
  });

  it("refuses empty and too long titles and posts", async () => {
    signInAs("Dave");
    expect(await createThread(WORKSHOP, " ", "x")).toEqual(
      error("INVALID_INPUT", "threadTitleRequired"),
    );
    expect(
      await createThread(
        WORKSHOP,
        "t".repeat(MAX_THREAD_TITLE_LENGTH + 1),
        "x",
      ),
    ).toEqual(
      error("INVALID_INPUT", "threadTitleTooLong", MAX_THREAD_TITLE_LENGTH),
    );
    const id = await thread("Dave");
    signInAs("Dave");
    expect(await createPost(id, "  ")).toEqual(
      error("INVALID_INPUT", "postRequired"),
    );
    expect(await createPost(id, "p".repeat(MAX_POST_LENGTH + 1))).toEqual(
      error("INVALID_INPUT", "postTooLong", MAX_POST_LENGTH),
    );
  });

  it("allows 5 posts a minute and 10 new threads a day", async () => {
    const id = await thread("Dave");
    for (let i = 0; i < 5; i++) await post("Erin", id);
    expect(await as("Erin", () => createPost(id, "x"))).toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
    for (let i = 0; i < 9; i++) await thread("Dave");
    expect(await as("Dave", () => createThread(WORKSHOP, "T", "x"))).toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
  });
});

describe("bans and blocks (4)", () => {
  it("a community ban stops the author's forum, not the global ones", async () => {
    const aliceThread = await thread("Alice", ALICE_FORUM);
    const alicePost = await firstPost(aliceThread);
    await ok(
      as("Alice", () =>
        banFromCommunity(ids.Alice.toString(), "Dave", 7, "Spam"),
      ),
    );
    signInAs("Dave");
    expect(await createThread(ALICE_FORUM, "T", "x")).toEqual(REFUSED);
    expect(await createPost(aliceThread, "x")).toEqual(REFUSED);
    expect(await quotePost(alicePost, "x")).toEqual(REFUSED);
    expect(await react("post", alicePost, "heart")).toEqual(REFUSED);
    await thread("Dave");
  });

  it("a global ban stops every forum", async () => {
    const global = await thread("Erin");
    const author = await thread("Alice", ALICE_FORUM);
    await User.updateOne(
      { _id: ids.Dave },
      { $set: { globalBan: { until: null, reason: "x", by: ids.Admin } } },
    );
    signInAs("Dave");
    expect(await createThread(WORKSHOP, "T", "x")).toEqual(REFUSED);
    expect(await createThread(ALICE_FORUM, "T", "x")).toEqual(REFUSED);
    expect(await createPost(global, "x")).toEqual(REFUSED);
    expect(await createPost(author, "x")).toEqual(REFUSED);
  });

  it("a block stops replying in the blocker's thread and quoting their post", async () => {
    const erins = await thread("Erin");
    const erinsPost = await firstPost(erins);
    const daves = await thread("Dave");
    await ok(as("Erin", () => blockUser("Dave")));
    signInAs("Dave");
    expect(await createPost(erins, "x")).toEqual(REFUSED);
    expect(await quotePost(erinsPost, "x")).toEqual(REFUSED);
    expect(await react("post", erinsPost, "heart")).toEqual(REFUSED);
    // The blocker does not see the blocked account's thread at all.
    expect(await as("Erin", () => createPost(daves, "x"))).toEqual(
      THREAD_NOT_FOUND,
    );
  });

  it("a block with the forum's author stops writing there", async () => {
    const id = await thread("Alice", ALICE_FORUM);
    await ok(as("Alice", () => blockUser("Dave")));
    expect(await as("Dave", () => createPost(id, "x"))).toEqual(REFUSED);
    expect(await as("Dave", () => createThread(ALICE_FORUM, "T", "x"))).toEqual(
      REFUSED,
    );
  });
});

describe("moderation (5)", () => {
  it("the author and their moderators hide and restore posts and threads of the forum", async () => {
    const id = await thread("Dave", ALICE_FORUM);
    const firstId = await firstPost(id);
    await ok(as("Erin", () => react("post", firstId, "heart")));
    const reply = await post("Erin", id);
    await ok(as("Alice", () => hideContent("post", reply, "Rude")));
    const view = await viewOf("Erin", id);
    expect(view!.posts[1]).toMatchObject({ state: "hidden", body: null });
    expect((await viewOf("Alice", id))!.posts[1].canRestore).toBe(true);
    expect(await as("Erin", () => react("post", reply, "heart"))).toEqual(
      error("NOT_FOUND", "reactionTargetNotFound"),
    );

    await ok(as("Carol", () => hideContent("thread", id)));
    expect(await viewOf(null, id)).toBeNull();
    expect(await viewOf("Erin", id)).toBeNull();
    expect((await viewOf("Carol", id))?.hidden).toBe(true);
    expect(await as("Erin", () => createPost(id, "x"))).toEqual(
      THREAD_NOT_FOUND,
    );
    const purge = await ForumPost.find({ threadId: id }).lean();
    expect(purge.every(({ purgeAt }) => purgeAt instanceof Date)).toBe(true);
    expect(await Reaction.findOne({ targetId: firstId }).lean()).toMatchObject({
      purgeAt: purge[0].purgeAt,
    });

    await ok(as("Alice", () => restoreContent("thread", id)));
    expect((await viewOf(null, id))?.hidden).toBe(false);
    expect(
      (await Reaction.findOne({ targetId: firstId }).lean())?.purgeAt,
    ).toBeUndefined();
    // The post hidden on its own stays hidden.
    expect(
      (
        await ForumPost.find({
          threadId: id,
          purgeAt: { $exists: true },
        }).lean()
      ).map(({ _id }) => _id.toString()),
    ).toEqual([reply]);
    expect(
      await ModerationLog.find()
        .select({ action: 1, targetType: 1, authorId: 1 })
        .lean(),
    ).toMatchObject([
      { action: "hide", targetType: "post", authorId: ids.Alice },
      { action: "hide", targetType: "thread", authorId: ids.Alice },
      { action: "restore", targetType: "thread", authorId: ids.Alice },
    ]);
  });

  it("admins and the category's moderators moderate the global forums", async () => {
    const workshop = await thread("Dave");
    const park = await thread("Dave", { category: "hyde-park" });
    const workshopPost = await firstPost(workshop);
    await ok(as("Bob", () => hideContent("post", workshopPost)));
    await ok(as("Admin", () => hideContent("thread", park)));
    expect(
      await ModerationLog.findOne({ targetType: "thread" }).lean(),
    ).toMatchObject({
      authorId: null,
      scope: "global",
    });
    const announcement = await thread("Admin", { category: "announcements" });
    await ForumCategory.updateOne(
      { _id: "announcements" },
      { $set: { moderatorIds: [ids.Bob] } },
    );
    expect(await as("Bob", () => hideContent("thread", announcement))).toEqual(
      error("FORBIDDEN", "cannotModerate"),
    );
  });

  it("outside the moderator's forum it is not found", async () => {
    const park = await thread("Dave", { category: "hyde-park" });
    const author = await thread("Dave", ALICE_FORUM);
    signInAs("Bob");
    expect(await hideContent("thread", park)).toEqual(THREAD_NOT_FOUND);
    expect(await hideContent("post", await firstPost(author))).toEqual(
      POST_NOT_FOUND,
    );
    signInAs("Alice");
    expect(await hideContent("thread", park)).toEqual(THREAD_NOT_FOUND);
    signInAs("Erin");
    expect(await hideContent("post", await firstPost(author))).toEqual(
      POST_NOT_FOUND,
    );
    expect(await restoreContent("thread", author)).toEqual(THREAD_NOT_FOUND);
  });
});

describe("notifications (6)", () => {
  it("a followed thread notifies of a new post, a quote the quoted writer", async () => {
    const id = await thread("Dave");
    await ok(as("Erin", () => followThread(id)));
    await post("Carol", id, "Hello @Bob");
    await flushAfter();
    expect(
      (await Notification.distinct("userId", { type: "threadReply" }))
        .map(String)
        .sort(),
    ).toEqual([ids.Dave, ids.Erin].map(String).sort());
    expect(
      await Notification.countDocuments({ type: "mention", userId: ids.Bob }),
    ).toBe(1);

    const first = await firstPost(id);
    await ok(as("Erin", () => quotePost(first, "Yes")));
    await flushAfter();
    const quote = await Notification.findOne({ type: "quote" }).lean();
    expect(quote).toMatchObject({ userId: ids.Dave, actorIds: [ids.Erin] });
    // The quoted writer is notified once, of the quote.
    expect(
      await Notification.countDocuments({
        userId: ids.Dave,
        postId: quote!.postId,
      }),
    ).toBe(1);
    const [latest] = await listNotifications(ids.Dave.toString());
    expect(latest).toMatchObject({
      type: "quote",
      title: "Thread",
      onPost: true,
      href: `/forums/t/${id}#post-${quote!.postId!.toString()}`,
    });

    await ok(as("Erin", () => unfollowThread(id)));
    await post("Carol", id);
    await flushAfter();
    expect(
      await Notification.countDocuments({
        userId: ids.Erin,
        type: "threadReply",
      }),
    ).toBe(1);
  });

  it("tells only followers who see the thread", async () => {
    const id = await thread("Dave");
    for (const name of ["Erin", "Carol", "Bob"] as const) {
      await ok(as(name, () => followThread(id)));
    }
    await ok(as("Carol", () => blockUser("Dave")));
    const threadId = new Types.ObjectId(id);
    expect(
      (await threadReplyRecipients(threadId, [ids.Erin])).map(String).sort(),
    ).toEqual([ids.Dave, ids.Bob].map(String).sort());
    await ok(as("Admin", () => hideContent("thread", id)));
    // Hidden: only its moderators, here Bob of the workshop.
    expect(await threadReplyRecipients(threadId, [])).toEqual([ids.Bob]);
    // A global ban takes moderation away, and with it the hidden thread (task 91).
    await User.updateOne(
      { _id: ids.Bob },
      {
        $set: {
          globalBan: {
            until: null,
            reason: "x",
            by: ids.Admin,
            at: new Date(),
          },
        },
      },
    );
    expect(await threadReplyRecipients(threadId, [])).toEqual([]);
  });

  it("a reaction to a post notifies its writer, grouped per post", async () => {
    const id = await thread("Dave");
    const first = await firstPost(id);
    await ok(as("Erin", () => react("post", first, "heart")));
    await ok(as("Carol", () => react("post", first, "fire")));
    expect(await as("Dave", () => react("post", first, "heart"))).toEqual(
      REFUSED,
    );
    await flushAfter();
    expect(await Notification.find({ type: "reaction" }).lean()).toMatchObject([
      { userId: ids.Dave, count: 2, objectKey: `reaction:post:${first}` },
    ]);
    expect(await Reaction.findOne({ targetType: "post" }).lean()).toMatchObject(
      { authorId: null, folderId: null, storyId: null },
    );
    const summaries = await getReactionSummaries(null, "post", [first]);
    expect(summaries.get(first)?.groups).toHaveLength(2);
  });
});

describe("reading (7)", () => {
  it("a guest reads the forums; the blocker does not see the blocked account's posts", async () => {
    const id = await thread("Erin");
    await post("Dave", id, "From Dave");
    expect((await viewOf(null, id))!.posts).toHaveLength(2);
    await ok(as("Erin", () => blockUser("Dave")));
    expect((await viewOf("Erin", id))!.posts.map(({ body }) => body)).toEqual([
      "First",
    ]);
    const daves = await thread("Carol");
    await post("Dave", daves);
    const place = (await findCategoryPlace("workshop"))!;
    await thread("Dave", WORKSHOP, "By Dave");
    expect(
      (await listThreads(ids.Erin.toString(), place)).map(({ title }) => title),
    ).not.toContain("By Dave");
    expect(
      (await listThreads(null, place)).map(({ title }) => title),
    ).toContain("By Dave");
  });
});

describe("reports of posts", () => {
  it("go to the author of the forum or to the admins", async () => {
    const author = await thread("Dave", ALICE_FORUM);
    const global = await thread("Dave");
    const alices = await thread("Alice", ALICE_FORUM);
    signInAs("Erin");
    await ok(report("post", await firstPost(author), "spam", ""));
    await ok(report("post", await firstPost(global), "spam", ""));
    await ok(report("post", await firstPost(alices), "spam", ""));
    expect(
      await Report.find()
        .sort({ createdAt: 1 })
        .select({ route: 1, authorId: 1, targetUserId: 1, targetType: 1 })
        .lean(),
    ).toMatchObject([
      {
        targetType: "post",
        route: "author",
        authorId: ids.Alice,
        targetUserId: ids.Dave,
      },
      { targetType: "post", route: "admin", targetUserId: ids.Dave },
      { targetType: "post", route: "admin", targetUserId: ids.Alice },
    ]);
    const globalPost = await firstPost(global);
    expect(
      await as("Dave", () => report("post", globalPost, "spam", "")),
    ).toEqual(REFUSED);
    expect(
      await as("Erin", () =>
        report("post", new Types.ObjectId().toString(), "spam", ""),
      ),
    ).toEqual(error("NOT_FOUND", "reportTargetNotFound"));
  });
});
