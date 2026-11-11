import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettings } from "@/app/[locale]/(protected)/actions";
import { publishAllChapters } from "@/app/[locale]/(protected)/folders/actions";
import { addToLibrary } from "@/app/[locale]/(protected)/library/actions";
import {
  acceptModeratorInvite,
  banFromCommunity,
  declineModeratorInvite,
  hideContent,
  inviteModerator,
  removeModerator,
  resolveReport,
} from "@/app/[locale]/(protected)/moderation/actions";
import {
  getNotifications,
  getNotificationSettings,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCounts,
} from "@/app/[locale]/(protected)/notifications/actions";
import {
  addComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { react } from "@/app/[locale]/p/[nickname]/[folder]/reaction-actions";
import { rate } from "@/app/[locale]/p/[nickname]/[folder]/rating-actions";
import { follow } from "@/app/[locale]/p/[nickname]/actions";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import { Notification } from "@/lib/models/notification";
import { Profile } from "@/lib/models/profile";
import { Report } from "@/lib/models/report";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { listNotifications } from "@/lib/social/notification-list";
import {
  MAX_NOTIFICATIONS,
  NOTIFICATION_TTL_DAYS,
} from "@/lib/social/notifications";
import { notify } from "@/lib/social/notify";
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
let admin: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string, role?: "admin") {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
    ...(role && { role }),
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

async function as<T>(userId: Types.ObjectId, action: () => Promise<T>) {
  signInAs(userId);
  const result = await action();
  await flushAfter();
  return result;
}

async function seedBook() {
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
  return { folderId: folder._id.toString(), storyId: chapter._id.toString() };
}

const of = (userId: Types.ObjectId) =>
  Notification.find({ userId }).sort({ createdAt: 1 }).lean();

async function commentAs(userId: Types.ObjectId) {
  const result = await as(userId, () =>
    addComment({ storyId: book.storyId }, "A comment"),
  );
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  frank = await createUser("Frank");
  admin = await createUser("Admin", "admin");
  book = await seedBook();
});

describe("events (criterion 1)", () => {
  it("a comment notifies the text's author, not the writer", async () => {
    const commentId = await commentAs(dave);
    const [notification] = await of(alice);
    expect(notification).toMatchObject({
      type: "comment",
      group: "interactions",
      count: 1,
      readAt: null,
      actorIds: [dave],
      commentId: new Types.ObjectId(commentId),
    });
    expect(await of(dave)).toEqual([]);
    const [view] = await listNotifications(alice.toString());
    expect(view).toMatchObject({
      type: "comment",
      actors: ["Dave"],
      title: "One",
      href: `/p/Alice/book/one#comment-${commentId}`,
      read: false,
    });
  });

  it("a reply notifies the writers replied to and the text's author once each", async () => {
    const commentId = await commentAs(dave);
    await as(erin, () => replyToComment(commentId, "Agreed"));
    expect((await of(dave)).map(({ type }) => type)).toEqual(["reply"]);
    expect((await of(alice)).map(({ type }) => type)).toEqual([
      "comment",
      "comment",
    ]);
    expect(await of(erin)).toEqual([]);

    // The author answering their reader: only the reader is told.
    await as(alice, () => replyToComment(commentId, "Thanks"));
    expect((await of(dave)).map(({ type }) => type)).toEqual([
      "reply",
      "reply",
    ]);
    expect(await of(alice)).toHaveLength(2);
  });

  it("a new follower, but not the same follow again", async () => {
    await as(dave, () => follow("Alice"));
    await as(dave, () => follow("Alice"));
    const notifications = await of(alice);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "follower" });
    const [view] = await listNotifications(alice.toString());
    expect(view.href).toBe("/p/Dave");
  });

  it("an addition to a library, anonymous while that library is private", async () => {
    await as(dave, () => addToLibrary(book.folderId, []));
    await as(dave, () => addToLibrary(book.folderId, []));
    expect(await of(alice)).toHaveLength(1);
    expect((await listNotifications(alice.toString()))[0]).toMatchObject({
      type: "library",
      actors: ["Dave"],
      title: "Book",
      href: "/p/Alice/book",
    });
    await Profile.create({ userId: dave, libraryPublic: false });
    expect((await listNotifications(alice.toString()))[0].actors).toEqual([]);
  });

  it("new chapters: one per reader with the chapter count, library before following", async () => {
    await as(dave, () => addToLibrary(book.folderId, []));
    await as(dave, () => follow("Alice"));
    await as(erin, () => follow("Alice"));
    await Story.insertMany(
      ["Two", "Three"].map((title) => ({
        userId: alice,
        folderId: book.folderId,
        title,
        content: "text",
        publication: "hidden" as const,
      })),
    );
    await as(alice, () => publishAllChapters(book.folderId));
    expect(await of(dave)).toMatchObject([
      { type: "libraryChapter", group: "chapters", count: 2 },
    ]);
    expect(await of(erin)).toMatchObject([
      { type: "followedChapter", count: 2 },
    ]);
    expect(
      (await of(alice)).filter(({ group }) => group === "chapters"),
    ).toEqual([]);
    const [view] = await listNotifications(erin.toString());
    expect(view).toMatchObject({
      author: "Alice",
      title: "Book",
      href: "/p/Alice/book",
    });

    // Publishing again stamps nothing new.
    await as(alice, () => publishAllChapters(book.folderId));
    expect(await of(erin)).toHaveLength(1);
  });

  it("moderation: invitation with acceptance, ban, hiding and removal", async () => {
    await as(alice, () => inviteModerator("Erin"));
    const [invite] = await listNotifications(erin.toString());
    expect(invite).toMatchObject({
      type: "moderatorInvite",
      author: "Alice",
      inviteFrom: alice.toString(),
    });
    await as(erin, () => acceptModeratorInvite(invite.inviteFrom!));
    expect((await listNotifications(erin.toString()))[0].inviteFrom).toBeNull();
    expect((await of(alice)).map(({ type }) => type)).toEqual([
      "moderatorAccepted",
    ]);

    const commentId = await commentAs(dave);
    await as(erin, () => hideContent("comment", commentId));
    await as(erin, () => banFromCommunity(alice.toString(), "Dave", 7, "Spam"));
    expect((await of(dave)).map(({ type }) => type)).toEqual(["hidden", "ban"]);
    const views = await listNotifications(dave.toString());
    // The moderator is not named; the ban names the community.
    expect(views.map(({ actors }) => actors)).toEqual([[], []]);
    expect(views[0]).toMatchObject({ type: "ban", author: "Alice" });
    // The community's author once hidden from the reader (here blocked) is not named.
    await Block.create({ blockerId: dave, blockedId: alice });
    expect((await listNotifications(dave.toString()))[0].author).toBeNull();

    await as(alice, () => removeModerator("Erin"));
    expect((await of(erin)).map(({ type }) => type)).toEqual([
      "moderatorInvite",
      "moderatorRemoved",
    ]);
  });

  it("a declined invitation tells the author", async () => {
    await as(alice, () => inviteModerator("Erin"));
    await as(erin, () => declineModeratorInvite(alice.toString()));
    expect((await of(alice)).map(({ type }) => type)).toEqual([
      "moderatorDeclined",
    ]);
  });

  it("reports go to the community or the admins, the outcome to the reporter", async () => {
    await as(alice, () => inviteModerator("Erin"));
    await as(erin, () => acceptModeratorInvite(alice.toString()));
    const commentId = await commentAs(frank);
    await as(dave, () => report("comment", commentId, "spam", ""));
    expect((await of(alice)).map(({ type }) => type)).toContain("report");
    expect((await of(erin)).map(({ type }) => type)).toEqual([
      "moderatorInvite",
      "report",
    ]);
    const [aliceView] = await listNotifications(alice.toString());
    expect(aliceView).toMatchObject({
      type: "report",
      actors: [],
      author: "Alice",
      href: "/moderation",
    });

    // The author's own content and profiles go to the admins.
    await as(dave, () => report("story", book.storyId, "spam", ""));
    await as(dave, () => report("profile", "Frank", "harassment", ""));
    expect((await of(admin)).map(({ type }) => type)).toEqual([
      "report",
      "report",
    ]);
    expect(await of(frank)).toEqual([]);
    // The admins' queue (task 88); the reporter is not named.
    expect(await listNotifications(admin.toString())).toMatchObject([
      {
        type: "report",
        community: false,
        href: "/admin?tab=reports",
        actors: [],
      },
      { type: "report", community: false, href: "/admin?tab=reports" },
    ]);
    expect(
      (await of(admin)).every(({ objectKey }) => objectKey === "report:admin"),
    ).toBe(true);
    // A globally banned admin decides nothing, so is not told.
    await User.updateOne(
      { _id: admin },
      {
        $set: {
          globalBan: { until: null, reason: "x", by: alice, at: new Date() },
        },
      },
    );
    await as(dave, () => report("profile", "Erin", "spam", ""));
    expect(await of(admin)).toHaveLength(2);

    // A report about a moderator is not shown to the other moderators.
    const erinComment = await commentAs(erin);
    await as(dave, () => report("comment", erinComment, "spam", ""));
    expect(await of(erin)).toHaveLength(2);

    const open = await Report.findOne({ route: "author" }).lean();
    await as(alice, () => resolveReport(open!._id.toString(), "resolved"));
    expect((await of(dave)).map(({ type }) => type)).toEqual([
      "reportResolved",
    ]);
  });
});

describe("grouping (criterion 2)", () => {
  it("joins new reactions to one object in one unread notification", async () => {
    await as(dave, () => react("story", book.storyId, "heart"));
    await as(erin, () => react("story", book.storyId, "laugh"));
    // A changed reaction and the same one again are not new.
    await as(dave, () => react("story", book.storyId, "laugh"));
    await as(dave, () => react("story", book.storyId, "laugh"));
    let notifications = await of(alice);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "reaction",
      count: 2,
      actorIds: [dave, erin],
    });
    expect((await listNotifications(alice.toString()))[0].actors).toEqual([
      "Erin",
      "Dave",
    ]);

    // Taken off and given again: the same person does not count twice.
    await as(dave, () => react("story", book.storyId, null));
    await as(dave, () => react("story", book.storyId, "heart"));
    expect((await of(alice))[0].count).toBe(2);

    // Once read, the next reaction starts a new one.
    await as(alice, () => markAllNotificationsRead());
    await as(frank, () => react("story", book.storyId, "heart"));
    notifications = await of(alice);
    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toMatchObject({ count: 1, actorIds: [frank] });
  });

  it("keeps reactions to a comment apart and notifies its writer", async () => {
    const commentId = await commentAs(dave);
    await as(erin, () => react("comment", commentId, "heart"));
    await as(alice, () => react("comment", commentId, "heart"));
    const notifications = await of(dave);
    expect(notifications).toMatchObject([
      { type: "reaction", count: 2, commentId: new Types.ObjectId(commentId) },
    ]);
    expect((await of(alice)).map(({ type }) => type)).toEqual(["comment"]);
  });

  it("joins ratings without naming anyone (anonymous, D80)", async () => {
    await as(dave, () => rate("story", book.storyId, 4));
    await as(erin, () => rate("story", book.storyId, 5));
    await as(erin, () => rate("story", book.storyId, 3));
    await as(dave, () => rate("folder", book.folderId, 5));
    const notifications = await of(alice);
    expect(notifications.map(({ count }) => count)).toEqual([2, 1]);
    const views = await listNotifications(alice.toString());
    expect(views.map(({ actors }) => actors)).toEqual([[], []]);
    expect(JSON.stringify(views)).not.toContain(dave.toString());
  });

  it("keeps at most the latest five actors", async () => {
    for (let i = 0; i < 7; i++) {
      await notify(alice, {
        type: "reaction",
        actorId: new Types.ObjectId(),
        storyIds: [book.storyId],
      });
    }
    const [notification] = await of(alice);
    expect(notification.count).toBe(7);
    expect(notification.actorIds).toHaveLength(5);
  });
});

describe("settings (criterion 3)", () => {
  it("a kind turned off creates nothing; the rest still arrive", async () => {
    expect(
      await as(alice, () =>
        saveSettings({ notifications: { comment: false } }),
      ),
    ).toEqual({ ok: true });
    const settings = await as(alice, () => getNotificationSettings());
    expect(settings.ok && settings.settings).toMatchObject({
      comment: false,
      reaction: true,
    });
    await commentAs(dave);
    await as(dave, () => react("story", book.storyId, "heart"));
    expect((await of(alice)).map(({ type }) => type)).toEqual(["reaction"]);
  });

  it("moderation cannot be turned off", async () => {
    expect(
      await as(dave, () => saveSettings({ notifications: { ban: false } })),
    ).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.settingsInvalid,
    });
    await as(alice, () =>
      banFromCommunity(alice.toString(), "Dave", null, "Spam"),
    );
    expect((await of(dave)).map(({ type }) => type)).toEqual(["ban"]);
  });
});

describe("blocks (criterion 4)", () => {
  it.each([
    [
      "the recipient blocked the actor",
      () => ({ blockerId: alice, blockedId: dave }),
    ],
    [
      "the actor blocked the recipient",
      () => ({ blockerId: dave, blockedId: alice }),
    ],
  ])("%s: nothing between them", async (_, edge) => {
    await Block.create(edge());
    await notify(alice, {
      type: "comment",
      actorId: dave,
      storyIds: [book.storyId],
    });
    await notify(alice, {
      type: "reaction",
      actorId: dave,
      storyIds: [book.storyId],
    });
    await notify(alice, {
      type: "comment",
      actorId: erin,
      storyIds: [book.storyId],
    });
    expect((await of(alice)).map(({ actorIds }) => actorIds)).toEqual([[erin]]);
  });

  it("keeps the new chapter from a blocked author's followers", async () => {
    await as(erin, () => follow("Alice"));
    await Block.create({ blockerId: erin, blockedId: alice });
    await Story.create({
      userId: alice,
      folderId: book.folderId,
      title: "Two",
      content: "text",
      publication: "hidden",
    });
    await as(alice, () => publishAllChapters(book.folderId));
    expect(await of(erin)).toEqual([]);
  });

  it("a block does not stop moderation", async () => {
    await Block.create({ blockerId: dave, blockedId: alice });
    await notify(dave, { type: "ban", actorId: alice, authorId: alice });
    expect(await of(dave)).toHaveLength(1);
  });
});

describe("list, counter and isolation (criterion 5)", () => {
  it("counts, lists and marks as read, for the owner only", async () => {
    await commentAs(dave);
    await as(erin, () => follow("Alice"));
    expect(await as(alice, () => unreadCounts())).toEqual({
      ok: true,
      notifications: 2,
      messages: 0,
    });
    const list = await as(alice, () => getNotifications());
    if (!list.ok) throw new Error(list.message);
    expect(list.unread).toBe(2);
    // Newest first.
    expect(list.notifications.map(({ type }) => type)).toEqual([
      "follower",
      "comment",
    ]);
    const [first] = list.notifications;

    // Another account's notification does not exist for erin.
    expect(await as(erin, () => markNotificationRead(first.id))).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: en.errors.notificationNotFound,
    });
    const other = await as(erin, () => getNotifications());
    expect(other.ok && other.notifications).toEqual([]);
    expect(await as(erin, () => markAllNotificationsRead())).toEqual({
      ok: true,
    });
    expect((await as(alice, () => unreadCounts())).ok && 2).toBe(2);

    expect(await as(alice, () => markNotificationRead(first.id))).toEqual({
      ok: true,
    });
    // Again: still ok, the date stays.
    const read = await Notification.findById(first.id).lean();
    expect(await as(alice, () => markNotificationRead(first.id))).toEqual({
      ok: true,
    });
    expect((await Notification.findById(first.id).lean())!.readAt).toEqual(
      read!.readAt,
    );
    expect(await as(alice, () => unreadCounts())).toMatchObject({
      notifications: 1,
    });
    await as(alice, () => markAllNotificationsRead());
    expect(await as(alice, () => unreadCounts())).toMatchObject({
      notifications: 0,
    });
  });

  it("rejects a bad id and a signed-out user", async () => {
    expect(await as(alice, () => markNotificationRead("x"))).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.requestInvalid,
    });
    signInAs(null);
    for (const result of [
      await unreadCounts(),
      await getNotifications(),
      await markAllNotificationsRead(),
      await markNotificationRead(new Types.ObjectId().toString()),
    ]) {
      expect(result).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
    }
  });

  it("shows a notification without a link once its text is gone", async () => {
    await commentAs(dave);
    await Story.updateOne(
      { _id: book.storyId },
      { $set: { deletedAt: new Date() } },
    );
    expect((await listNotifications(alice.toString()))[0]).toMatchObject({
      title: null,
      href: null,
    });
  });
});

describe("limits (criterion 6)", () => {
  it("keeps the newest MAX_NOTIFICATIONS", async () => {
    const start = Date.now() - DAY;
    await Notification.insertMany(
      Array.from({ length: MAX_NOTIFICATIONS }, (_, i) => ({
        userId: alice,
        type: "follower",
        group: "interactions",
        objectKey: `follower:user:${i}`,
        createdAt: new Date(start + i * 1000),
        updatedAt: new Date(start + i * 1000),
      })),
      { timestamps: false } as never,
    );
    await notify(alice, { type: "follower", actorId: dave });
    expect(await Notification.countDocuments({ userId: alice })).toBe(
      MAX_NOTIFICATIONS,
    );
    expect(
      await Notification.exists({ objectKey: "follower:user:0" }),
    ).toBeNull();
    expect(
      await Notification.exists({
        objectKey: `follower:user:${dave.toString()}`,
      }),
    ).not.toBeNull();
  });

  it("expires after NOTIFICATION_TTL_DAYS of no change", async () => {
    const indexes = await Notification.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: { updatedAt: 1 },
        expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60,
      }),
    );
    expect(NOTIFICATION_TTL_DAYS).toBe(90);
    expect(MAX_NOTIFICATIONS).toBe(500);
  });
});
