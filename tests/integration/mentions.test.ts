import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettings } from "@/app/[locale]/(protected)/actions";
import { suggestNicknames } from "@/app/[locale]/mention-actions";
import {
  addComment,
  editComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { Folder } from "@/lib/models/folder";
import { Notification } from "@/lib/models/notification";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS } from "@/lib/rate-limit";
import { getCommentThread } from "@/lib/social/comments";
import { mentionRecipients, MAX_SUGGESTIONS } from "@/lib/social/mentions";
import { listNotifications } from "@/lib/social/notification-list";
import en from "@/messages/en.json";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let frank: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
  });
  return insertedId;
}

function signInAs(userId: Types.ObjectId | null) {
  vi.mocked(requireUser).mockResolvedValue(
    userId
      ? { ok: true, userId: userId.toString() }
      : { ok: false, error: "UNAUTHORIZED", message: "Signed out" },
  );
}

async function as<T>(userId: Types.ObjectId, run: () => Promise<T>) {
  signInAs(userId);
  return run();
}

async function comment(writer: Types.ObjectId, body: string) {
  const result = await as(writer, () =>
    addComment({ storyId: book.storyId }, body),
  );
  if (!result.ok) throw new Error(result.message);
  await flushAfter();
  return result.id;
}

const mentionsOf = (userId: Types.ObjectId) =>
  Notification.find({ userId, type: "mention" }).lean();

async function shownMentions(viewer: Types.ObjectId | null) {
  const thread = await getCommentThread(viewer?.toString() ?? null, book, null);
  return thread.comments
    .flatMap((c) => [c, ...c.replies])
    .map((c) => c.mentions);
}

const block = (blockerId: Types.ObjectId, blockedId: Types.ObjectId) =>
  Block.create({ blockerId, blockedId });

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  frank = await createUser("Frank");
  const folder = await Folder.create({
    userId: alice,
    name: "Book",
    published: true,
  });
  const chapter = await Story.create({
    userId: alice,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  book = { folderId: folder._id.toString(), storyId: chapter._id.toString() };
});

describe("mention of an existing user (1)", () => {
  it("links to the profile in its own case and notifies them", async () => {
    const id = await comment(dave, "Look @erin and @Frank");

    expect(await shownMentions(null)).toEqual([["Erin", "Frank"]]);
    const [notification] = await mentionsOf(erin);
    expect(notification).toMatchObject({
      actorIds: [dave],
      group: "conversations",
      commentId: new Types.ObjectId(id),
      storyIds: [new Types.ObjectId(book.storyId)],
    });
    expect(await mentionsOf(frank)).toHaveLength(1);
    const [view] = await listNotifications(erin.toString());
    expect(view).toMatchObject({
      type: "mention",
      actors: ["Dave"],
      title: "One",
      href: `/p/Alice/book/one#comment-${id}`,
    });
  });

  it("notifies of a mention in a reply, but not who gets the reply anyway", async () => {
    const parent = await comment(erin, "First");
    const result = await as(dave, () =>
      replyToComment(parent, "@Erin @Alice @Frank thanks"),
    );
    expect(result.ok).toBe(true);
    await flushAfter();

    expect(await mentionsOf(erin)).toHaveLength(0);
    expect(await mentionsOf(alice)).toHaveLength(0);
    expect(await mentionsOf(frank)).toHaveLength(1);
    expect(await shownMentions(null)).toEqual([[], ["Erin", "Alice", "Frank"]]);
  });

  it("notifies the text's author of a mention in a comment only as a comment", async () => {
    await comment(dave, "@Alice nice");
    expect(await mentionsOf(alice)).toHaveLength(0);
    expect(
      await Notification.countDocuments({ userId: alice, type: "comment" }),
    ).toBe(1);
  });

  it("notifies neither the writer nor more than 10 people", async () => {
    const many = await Promise.all(
      Array.from({ length: 11 }, (_, i) => createUser(`reader${i}`)),
    );
    await comment(dave, `@Dave ${many.map((_, i) => `@reader${i}`).join(" ")}`);
    expect(await mentionsOf(dave)).toHaveLength(0);
    expect(
      await Notification.countDocuments({
        type: "mention",
        userId: { $in: many },
      }),
    ).toBe(9);
  });

  it("respects the mention switch in the settings", async () => {
    await as(erin, () => saveSettings({ notifications: { mention: false } }));
    await comment(dave, "@Erin");
    expect(await mentionsOf(erin)).toHaveLength(0);
    expect(await shownMentions(null)).toEqual([["Erin"]]);
  });
});

describe("mention that does not link (2)", () => {
  it("leaves an unknown nickname as text without a notification", async () => {
    await comment(dave, "@Nobody here");
    expect(await shownMentions(null)).toEqual([[]]);
    expect(await Notification.countDocuments({ type: "mention" })).toBe(0);
  });

  it("does not link nor notify when the mentioned user blocked the writer", async () => {
    await block(erin, dave);
    await comment(dave, "@Erin");
    expect(await mentionsOf(erin)).toHaveLength(0);
    expect(await shownMentions(null)).toEqual([[]]);
  });

  it("does not link nor notify when the writer blocked the mentioned user", async () => {
    await block(dave, erin);
    await comment(dave, "@Erin");
    expect(await mentionsOf(erin)).toHaveLength(0);
    expect(await shownMentions(frank)).toEqual([[]]);
  });

  it("drops the link of an earlier mention after a block", async () => {
    await comment(dave, "@Erin");
    await block(erin, dave);
    expect(await shownMentions(null)).toEqual([[]]);
  });

  it("does not link nor notify a globally banned user", async () => {
    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "x", by: alice, at: new Date() } },
    );
    await comment(dave, "@Erin");
    expect(await mentionsOf(erin)).toHaveLength(0);
    expect(await shownMentions(null)).toEqual([[]]);
  });

  it("does not link a user the viewer blocked", async () => {
    await comment(dave, "@Erin");
    await block(frank, erin);
    expect(await shownMentions(frank)).toEqual([[]]);
    expect(await shownMentions(alice)).toEqual([["Erin"]]);
  });

  it("still mentions while the mentioned user is banned in the author's community", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: erin,
      until: null,
      reason: "x",
      by: alice,
    });
    await comment(dave, "@Erin");
    expect(await mentionsOf(erin)).toHaveLength(1);
  });

  it("does not notify outside a conversation when limited to its parties (85)", async () => {
    expect(
      await mentionRecipients(dave, "@Erin @Frank", { only: [dave, erin] }),
    ).toEqual([erin]);
  });
});

describe("edit (3)", () => {
  it("notifies only the people the edit adds", async () => {
    const id = await comment(dave, "@Erin");
    const result = await as(dave, () => editComment(id, "@erin and @Frank"));
    expect(result).toEqual({ ok: true });
    await flushAfter();

    expect(await mentionsOf(erin)).toHaveLength(1);
    expect(await mentionsOf(frank)).toHaveLength(1);
  });

  it("does not notify again a mention taken out and put back", async () => {
    const id = await comment(dave, "@Erin");
    await as(dave, () => editComment(id, "nobody"));
    await as(dave, () => editComment(id, "@Erin again"));
    await flushAfter();
    expect(await mentionsOf(erin)).toHaveLength(1);
  });

  it("does not mention-notify who already got a reply of the comment", async () => {
    const parent = await comment(erin, "First");
    const result = await as(dave, () => replyToComment(parent, "Thanks"));
    if (!result.ok) throw new Error(result.message);
    await flushAfter();
    await as(dave, () => editComment(result.id, "Thanks @Erin"));
    await flushAfter();
    expect(await mentionsOf(erin)).toHaveLength(0);
  });
});

describe("suggestNicknames (4)", () => {
  it("returns matching nicknames whatever the case, without the viewer", async () => {
    await createUser("Erik");
    await createUser("dErin");
    signInAs(erin);
    expect(await suggestNicknames("er")).toEqual({
      ok: true,
      nicknames: ["Erik"],
    });
    signInAs(dave);
    expect(await suggestNicknames("ER")).toEqual({
      ok: true,
      nicknames: ["Erik", "Erin"],
    });
    await createUser("x-ray_1");
    await createUser("xray");
    expect(await suggestNicknames("X-R")).toEqual({
      ok: true,
      nicknames: ["x-ray_1"],
    });
    expect(await suggestNicknames("x-ray_")).toEqual({
      ok: true,
      nicknames: ["x-ray_1"],
    });
  });

  it("leaves out accounts blocked either way and globally banned ones", async () => {
    const erik = await createUser("Erik");
    const eric = await createUser("Eric");
    await block(dave, erin);
    await block(erik, dave);
    await User.updateOne(
      { _id: eric },
      {
        globalBan: {
          until: new Date(Date.now() + DAY),
          reason: "x",
          by: alice,
          at: new Date(),
        },
      },
    );
    signInAs(dave);
    expect(await suggestNicknames("Er")).toEqual({ ok: true, nicknames: [] });
    signInAs(frank);
    expect(await suggestNicknames("Er")).toEqual({
      ok: true,
      nicknames: ["Erik", "Erin"],
    });
  });

  it("shows an account whose global ban has ended", async () => {
    await User.updateOne(
      { _id: erin },
      {
        globalBan: {
          until: new Date(Date.now() - DAY),
          reason: "x",
          by: alice,
          at: new Date(),
        },
      },
    );
    signInAs(dave);
    expect(await suggestNicknames("Erin")).toEqual({
      ok: true,
      nicknames: ["Erin"],
    });
  });

  it(`returns at most ${MAX_SUGGESTIONS}, sorted`, async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(`zed${i}`)),
    );
    signInAs(dave);
    const result = await suggestNicknames("Zed");
    expect(result).toEqual({
      ok: true,
      nicknames: Array.from({ length: MAX_SUGGESTIONS }, (_, i) => `zed${i}`),
    });
  });

  it("refuses a prefix that is not part of a nickname", async () => {
    signInAs(dave);
    for (const prefix of ["", "a.b", "x".repeat(31), 42, "^.*"]) {
      expect(await suggestNicknames(prefix as string)).toEqual({
        ok: false,
        error: "INVALID_INPUT",
        message: en.errors.requestInvalid,
      });
    }
  });

  it("needs a session", async () => {
    signInAs(null);
    expect(await suggestNicknames("Er")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("is limited per account", async () => {
    signInAs(dave);
    for (let i = 0; i < SOCIAL_LIMITS.suggest.max; i++) {
      expect((await suggestNicknames("Er")).ok).toBe(true);
    }
    expect(await suggestNicknames("Er")).toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: en.errors.tooManyAttempts,
    });
  });
});
