import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettings } from "@/app/[locale]/(protected)/actions";
import {
  getMessageSettings,
  getMessages,
  markConversationRead,
  sendMessage,
  startConversation,
} from "@/app/[locale]/(protected)/messages/actions";
import { unreadCounts } from "@/app/[locale]/(protected)/notifications/actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_DM_LENGTH } from "@/lib/limits";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { Conversation } from "@/lib/models/conversation";
import { Follow } from "@/lib/models/follow";
import { Message } from "@/lib/models/message";
import { Notification } from "@/lib/models/notification";
import { RateLimit } from "@/lib/models/rate-limit";
import { User } from "@/lib/models/user";
import {
  getConversation,
  listConversations,
  listMessages,
  MESSAGES_PAGE,
  setConversationClosed,
} from "@/lib/social/direct-messages";
import { listNotifications } from "@/lib/social/notification-list";
import en from "@/messages/en.json";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;

let dave: Types.ObjectId;
let erin: Types.ObjectId;
let frank: Types.ObjectId;

async function createUser(nickname: string, ageMs = 2 * DAY) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - ageMs),
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

const error = (code: string, key: keyof typeof en.errors) => ({
  ok: false,
  error: code,
  message: en.errors[key],
});
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");
const NOT_FOUND = error("NOT_FOUND", "conversationNotFound");
const RATE_LIMITED = error("RATE_LIMITED", "tooManyAttempts");

async function start(from: Types.ObjectId, to: string, body: string) {
  const result = await as(from, () => startConversation(to, body));
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

const bodies = async (viewer: Types.ObjectId, id: string) =>
  (await listMessages(
    viewer.toString(),
    new Types.ObjectId(id),
    null,
  ))!.messages.map(({ body, own }) => ({ body, own }));

const unreadMessages = async (userId: Types.ObjectId) => {
  const result = await as(userId, () => unreadCounts());
  if (!result.ok) throw new Error(result.message);
  return result.messages;
};

const banGlobally = (userId: Types.ObjectId) =>
  User.updateOne(
    { _id: userId },
    { globalBan: { until: null, reason: "x", by: frank, at: new Date() } },
  );

beforeEach(async () => {
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  frank = await createUser("Frank");
});

describe("two people exchange messages; a third does not see them (1)", () => {
  it("starts a conversation, answers in it and keeps one per pair", async () => {
    const id = await start(dave, "erin", "Hello **Erin**");
    expect(await as(erin, () => sendMessage(id, "Hi Dave"))).toEqual({
      ok: true,
    });
    // Writing to the same person again goes on in the same conversation.
    expect(await start(dave, "Erin", "Again")).toBe(id);

    expect(await bodies(dave, id)).toEqual([
      { body: "Hello **Erin**", own: true },
      { body: "Hi Dave", own: false },
      { body: "Again", own: true },
    ]);
    const conversation = await Conversation.findById(id).lean();
    expect(conversation).toMatchObject({
      participantIds: [dave, erin].sort((a, b) =>
        a.toString().localeCompare(b.toString()),
      ),
      pairKey: [dave, erin].map(String).sort().join(":"),
      closedAt: null,
    });
    expect(await Conversation.countDocuments()).toBe(1);
    const [listed] = await listConversations(erin.toString());
    expect(listed).toMatchObject({ id, nickname: "Dave", closed: false });
  });

  it("hides the conversation from anyone else", async () => {
    const id = await start(dave, "Erin", "Private");
    expect(await getConversation(frank.toString(), id)).toBeNull();
    expect(await listConversations(frank.toString())).toEqual([]);
    expect(await as(frank, () => sendMessage(id, "Me too"))).toEqual(NOT_FOUND);
    const first = (await Message.findOne().lean())!._id.toString();
    expect(await as(frank, () => getMessages(id, { after: first }))).toEqual(
      NOT_FOUND,
    );
    expect(await as(frank, () => markConversationRead(id))).toEqual(NOT_FOUND);
    expect(
      await as(frank, () => sendMessage(new Types.ObjectId().toString(), "x")),
    ).toEqual(NOT_FOUND);
  });

  it("requires a session and refuses oneself or an unknown nickname", async () => {
    signInAs(null);
    expect(await startConversation("Erin", "x")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await as(dave, () => startConversation("Dave", "x"))).toEqual(
      REFUSED,
    );
    expect(await as(dave, () => startConversation("Nobody", "x"))).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await as(dave, () => sendMessage("not-an-id", "x"))).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
  });

  it("pages back by MESSAGES_PAGE and polls what came after", async () => {
    const id = await start(dave, "Erin", "m0");
    const base = Date.now();
    await Message.insertMany(
      Array.from({ length: MESSAGES_PAGE + 4 }, (_, i) => ({
        conversationId: id,
        senderId: i % 2 ? erin : dave,
        body: `m${i + 1}`,
        createdAt: new Date(base + (i + 1) * 1000),
      })),
    );
    const latest = (await listMessages(
      dave.toString(),
      new Types.ObjectId(id),
      null,
    ))!;
    expect(latest.messages).toHaveLength(MESSAGES_PAGE);
    expect(latest.messages.at(-1)!.body).toBe(`m${MESSAGES_PAGE + 4}`);
    expect(latest.hasOlder).toBe(true);
    const older = await as(dave, () =>
      getMessages(id, { before: latest.messages[0].id }),
    );
    expect(older).toMatchObject({ ok: true, hasOlder: false, closed: false });
    expect(older.ok && older.messages.map(({ body }) => body)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
    ]);
    const after = await as(dave, () =>
      getMessages(id, { after: latest.messages.at(-2)!.id }),
    );
    expect(after.ok && after.messages.map(({ body }) => body)).toEqual([
      `m${MESSAGES_PAGE + 4}`,
    ]);
  });
});

describe("dmFrom (2)", () => {
  it("refuses a new conversation to nobody, existing ones go on", async () => {
    const id = await start(dave, "Erin", "Before");
    await as(erin, () => saveSettings({ messages: { dmFrom: "nobody" } }));
    expect(await as(erin, () => getMessageSettings())).toEqual({
      ok: true,
      dmFrom: "nobody",
    });

    expect(await as(frank, () => startConversation("Erin", "Hi"))).toEqual(
      REFUSED,
    );
    expect(await as(dave, () => sendMessage(id, "Still here"))).toEqual({
      ok: true,
    });
    expect(await start(dave, "Erin", "And again")).toBe(id);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("lets only the accounts the recipient follows start one with following", async () => {
    await as(erin, () => saveSettings({ messages: { dmFrom: "following" } }));
    await Follow.create({ followerId: erin, followeeId: dave });
    // Following the recipient is not enough: the recipient must follow the sender.
    await Follow.create({ followerId: frank, followeeId: erin });

    expect(await as(frank, () => startConversation("Erin", "Hi"))).toEqual(
      REFUSED,
    );
    expect(await as(dave, () => startConversation("Erin", "Hi"))).toMatchObject(
      { ok: true },
    );
  });

  it("defaults to everyone and refuses an unknown value", async () => {
    expect(await as(erin, () => getMessageSettings())).toEqual({
      ok: true,
      dmFrom: "everyone",
    });
    expect(
      await as(erin, () => saveSettings({ messages: { dmFrom: "friends" } })),
    ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("global ban and block (3)", () => {
  it("refuses a globally banned sender, also in an existing conversation", async () => {
    const id = await start(dave, "Erin", "Before");
    await banGlobally(dave);
    expect(await as(dave, () => sendMessage(id, "x"))).toEqual(REFUSED);
    expect(await as(dave, () => startConversation("Frank", "x"))).toEqual(
      REFUSED,
    );
  });

  it("refuses writing to a globally banned account", async () => {
    const id = await start(dave, "Erin", "Before");
    await banGlobally(erin);
    expect(await as(dave, () => sendMessage(id, "x"))).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await as(frank, () => startConversation("Erin", "x"))).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
  });

  it("closes the conversation both ways on a block, without closedAt", async () => {
    const id = await start(dave, "Erin", "Before");
    await Block.create({ blockerId: erin, blockedId: dave });

    expect(await as(dave, () => sendMessage(id, "x"))).toEqual(REFUSED);
    expect(await as(erin, () => sendMessage(id, "x"))).toEqual(REFUSED);
    expect(await as(dave, () => startConversation("Erin", "x"))).toEqual(
      REFUSED,
    );
    expect(
      await as(frank, () => startConversation("Erin", "Hi")),
    ).toMatchObject({ ok: true });
    for (const viewer of [dave, erin]) {
      expect(await getConversation(viewer.toString(), id)).toMatchObject({
        closed: true,
      });
      const [first] = (await listConversations(viewer.toString())).filter(
        (c) => c.id === id,
      );
      expect(first.closed).toBe(true);
    }
    // The history stays readable for both.
    expect(await bodies(erin, id)).toEqual([{ body: "Before", own: false }]);
    const last = (await Message.findOne({ conversationId: id }).lean())!;
    expect(
      await as(dave, () => getMessages(id, { after: last._id.toString() })),
    ).toMatchObject({ ok: true, closed: true, messages: [] });
  });

  it("closes and opens a conversation through setConversationClosed (task 86)", async () => {
    const id = await start(dave, "Erin", "Before");
    await setConversationClosed(erin, dave, true);
    expect((await Conversation.findById(id).lean())!.closedAt).toBeInstanceOf(
      Date,
    );
    expect(await as(dave, () => sendMessage(id, "x"))).toEqual(REFUSED);
    await setConversationClosed(dave, erin, false);
    expect(await as(dave, () => sendMessage(id, "x"))).toEqual({ ok: true });
  });

  it("does not let a community ban stop direct messages (D80)", async () => {
    await CommunityBan.create({
      authorId: erin,
      userId: dave,
      by: erin,
      until: null,
      reason: "spam",
    });
    expect(await as(dave, () => startConversation("Erin", "Hi"))).toMatchObject(
      { ok: true },
    );
  });
});

describe("limits (4)", () => {
  it("refuses a body over MAX_DM_LENGTH or empty", async () => {
    signInAs(dave);
    expect(
      await startConversation("Erin", "x".repeat(MAX_DM_LENGTH + 1)),
    ).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.dmTooLong.replace(
        "{max, number}",
        MAX_DM_LENGTH.toLocaleString("en"),
      ),
    });
    expect(await startConversation("Erin", "  ")).toEqual(
      error("INVALID_INPUT", "messageRequired"),
    );
    const id = await start(dave, "Erin", "x".repeat(MAX_DM_LENGTH));
    expect(await as(dave, () => sendMessage(id, " "))).toEqual(
      error("INVALID_INPUT", "messageRequired"),
    );
  });

  it("allows 30 messages a minute", async () => {
    const id = await start(dave, "Erin", "m0");
    for (let i = 1; i < 30; i++) {
      expect(await as(dave, () => sendMessage(id, `m${i}`))).toEqual({
        ok: true,
      });
    }
    expect(await as(dave, () => sendMessage(id, "m30"))).toEqual(RATE_LIMITED);
  });

  it("allows 10 new conversations a day; going on in one is not a new one", async () => {
    await Promise.all(
      Array.from({ length: 11 }, (_, i) => createUser(`Reader${i}`)),
    );
    for (let i = 0; i < 10; i++) {
      await start(dave, `Reader${i}`, "Hi");
    }
    expect(await as(dave, () => startConversation("Reader10", "Hi"))).toEqual(
      RATE_LIMITED,
    );
    expect(await start(dave, "Reader0", "Again")).toBeTruthy();
    const day = await RateLimit.findOne({ _id: /^conversation-day:/ }).lean();
    expect(day!.count).toBe(11);
  });

  it("gives an account younger than 24 hours half of the limits", async () => {
    const grace = await createUser("Grace", 60 * 1000);
    await Promise.all(
      Array.from({ length: 6 }, (_, i) => createUser(`Reader${i}`)),
    );
    for (let i = 0; i < 5; i++) await start(grace, `Reader${i}`, "Hi");
    expect(await as(grace, () => startConversation("Reader5", "Hi"))).toEqual(
      RATE_LIMITED,
    );
    const id = (await Conversation.findOne().lean())!._id.toString();
    // The 5 first messages took 5 of the 15 a minute.
    for (let i = 0; i < 10; i++) {
      expect(await as(grace, () => sendMessage(id, `m${i}`))).toEqual({
        ok: true,
      });
    }
    expect(await as(grace, () => sendMessage(id, "over"))).toEqual(
      RATE_LIMITED,
    );
  });
});

describe("unread counter and reading (5)", () => {
  it("counts conversations with unread messages until they are read", async () => {
    const id = await start(dave, "Erin", "One");
    await start(frank, "Erin", "Two");
    expect(await unreadMessages(erin)).toBe(2);
    // The sender's own messages are never unread.
    expect(await unreadMessages(dave)).toBe(0);
    await as(dave, () => sendMessage(id, "Three"));
    expect(await unreadMessages(erin)).toBe(2);

    expect(await as(erin, () => markConversationRead(id))).toEqual({
      ok: true,
    });
    expect(await unreadMessages(erin)).toBe(1);
    const listed = await listConversations(erin.toString());
    expect(listed.map(({ nickname, unread }) => [nickname, unread])).toEqual([
      ["Dave", false],
      ["Frank", true],
    ]);
    await as(dave, () => sendMessage(id, "Four"));
    expect(await unreadMessages(erin)).toBe(2);
    // Answering reads the conversation.
    await as(erin, () => sendMessage(id, "Reply"));
    expect(await unreadMessages(erin)).toBe(1);
    expect(await unreadMessages(dave)).toBe(1);
  });
});

describe("unread state under races (5)", () => {
  it("keeps the latest lastMessageAt when an earlier message is written last", async () => {
    const id = await start(dave, "Erin", "One");
    const later = new Date(Date.now() + 60_000);
    await Conversation.updateOne({ _id: id }, { lastMessageAt: later });
    await as(erin, () => sendMessage(id, "Two"));
    const conversation = (await Conversation.findById(id).lean())!;
    expect(conversation.lastMessageAt).toEqual(later);
    expect(conversation.unreadBy).toEqual([dave]);
  });

  it("does not count a conversation without messages as unread", async () => {
    await Conversation.create({
      participantIds: [dave, erin],
      pairKey: [dave, erin].map(String).sort().join(":"),
      lastMessageAt: new Date(),
    });
    expect(await unreadMessages(erin)).toBe(0);
    const id = (await Conversation.findOne().lean())!._id.toString();
    expect(await as(erin, () => getMessages(id, { after: null }))).toEqual({
      ok: true,
      messages: [],
      hasOlder: false,
      closed: false,
    });
    expect(await as(dave, () => sendMessage(id, "First"))).toEqual({
      ok: true,
    });
    const latest = await as(erin, () => getMessages(id, { after: null }));
    expect(latest.ok && latest.messages.map(({ body }) => body)).toEqual([
      "First",
    ]);
  });
});

describe("mentions (task 82)", () => {
  it("notifies the other party of a mention, nobody else", async () => {
    const id = await start(dave, "Erin", "Hey @Erin, ask @Frank");
    await flushAfter();
    expect(await Notification.countDocuments({ userId: frank })).toBe(0);
    const [notification] = await Notification.find({ userId: erin }).lean();
    expect(notification).toMatchObject({
      type: "mention",
      group: "conversations",
      actorIds: [dave],
      conversationId: new Types.ObjectId(id),
    });
    const [view] = await listNotifications(erin.toString());
    expect(view).toMatchObject({
      type: "mention",
      actors: ["Dave"],
      inMessage: true,
      href: `/messages/${id}`,
    });

    await as(erin, () => sendMessage(id, "@Dave @Frank"));
    await flushAfter();
    expect(await Notification.countDocuments({ userId: dave })).toBe(1);
    expect(await Notification.countDocuments({ userId: frank })).toBe(0);
  });

  it("links the mentions in the thread as for comments", async () => {
    const id = await start(dave, "Erin", "@erin and @Frank");
    const [message] = (await listMessages(
      erin.toString(),
      new Types.ObjectId(id),
      null,
    ))!.messages;
    expect(message.mentions).toEqual(["Erin", "Frank"]);
  });

  it("respects the mention switch", async () => {
    await as(erin, () => saveSettings({ notifications: { mention: false } }));
    await start(dave, "Erin", "@Erin");
    await flushAfter();
    expect(await Notification.countDocuments({ userId: erin })).toBe(0);
  });
});
