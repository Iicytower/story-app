import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptModeratorInvite,
  banFromCommunity,
  declineModeratorInvite,
  hideContent,
  inviteModerator,
  liftCommunityBan,
  removeModerator,
  resignModerator,
  restoreContent,
} from "@/app/[locale]/(protected)/moderation/actions";
import {
  addComment,
  deleteComment,
  editComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { MAX_BAN_REASON_LENGTH, MAX_MODERATORS } from "@/lib/limits";
import { Comment, HIDDEN_COMMENT_TTL_DAYS } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Folder } from "@/lib/models/folder";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Reaction } from "@/lib/models/reaction";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS } from "@/lib/rate-limit";
import { getCommentThread } from "@/lib/social/comments";
import {
  activeCommunityBan,
  getModerationOverview,
  hasModerationAccess,
  isBannedAt,
  listCommunityBans,
  listHiddenComments,
  listModerationLog,
  listModerators,
  tabsFor,
} from "@/lib/social/moderation";
import { canInteract, isModeratorOf } from "@/lib/social/permissions";
import en from "@/messages/en.json";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const error = (
  code: string,
  key: keyof typeof en.errors,
  values?: Record<string, string>,
) => ({
  ok: false,
  error: code,
  message: values
    ? Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}, number}`, value),
        en.errors[key] as string,
      )
    : en.errors[key],
});
const OK = { ok: true };
const INVALID = error("INVALID_INPUT", "requestInvalid");
const COMMENT_NOT_FOUND = error("NOT_FOUND", "commentNotFound");
const COMMUNITY_NOT_FOUND = error("NOT_FOUND", "communityNotFound");
const CANNOT_MODERATE = error("FORBIDDEN", "cannotModerate");
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");

let alice: Types.ObjectId;
let bob: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string, age = 2 * DAY) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - age),
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

async function seedBook(author: Types.ObjectId, name = "Book") {
  const folder = await Folder.create({
    userId: author,
    name,
    published: true,
  });
  const chapter = await Story.create({
    userId: author,
    folderId: folder._id,
    title: "One",
    content: "text",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id.toString(), storyId: chapter._id.toString() };
}

async function comment(
  as: Types.ObjectId,
  body: string,
  place: { storyId: string } = { storyId: book.storyId },
) {
  signInAs(as);
  const result = await addComment(place, body);
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

async function reply(as: Types.ObjectId, parentId: string, body: string) {
  signInAs(as);
  const result = await replyToComment(parentId, body);
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

async function makeModerator(userId: Types.ObjectId, authorId = alice) {
  await CommunityModerator.create({ authorId, userId, state: "active" });
}

const as = <T>(user: Types.ObjectId, run: () => Promise<T>) => {
  signInAs(user);
  return run();
};

const thread = (viewer: Types.ObjectId | null) =>
  getCommentThread(viewer?.toString() ?? null, book, null);

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  book = await seedBook(alice);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("hiding and restoring (criterion 1)", () => {
  it("the author hides and restores a comment; its reactions follow", async () => {
    const id = await comment(dave, "Rude");
    await Reaction.create({
      userId: erin,
      targetType: "comment",
      targetId: id,
      authorId: alice,
      folderId: book.folderId,
      storyId: book.storyId,
      reaction: "heart",
      createdAt: new Date(),
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-11-11T10:00:00Z");
    vi.setSystemTime(now);

    expect(
      await as(alice, () => hideContent("comment", id, "  Insults  ")),
    ).toEqual(OK);
    const hidden = await Comment.findById(id).lean();
    const purgeAt = new Date(now.getTime() + HIDDEN_COMMENT_TTL_DAYS * DAY);
    expect(hidden).toMatchObject({
      hidden: { by: alice, at: now, reason: "Insults" },
      purgeAt,
    });
    expect((await Reaction.findOne({ targetId: id }).lean())!.purgeAt).toEqual(
      purgeAt,
    );
    const [shown] = (await thread(erin)).comments;
    expect(shown).toMatchObject({ state: "hidden", body: null, author: null });

    expect(await as(alice, () => restoreContent("comment", id))).toEqual(OK);
    const restored = await Comment.findById(id).lean();
    expect(restored!.hidden).toBeUndefined();
    expect(restored!.purgeAt).toBeUndefined();
    expect(
      (await Reaction.findOne({ targetId: id }).lean())!.purgeAt,
    ).toBeUndefined();
    expect((await thread(erin)).comments[0]).toMatchObject({
      state: "visible",
      body: "Rude",
    });
  });

  it("an active moderator hides and restores; replies stay under the placeholder", async () => {
    await makeModerator(erin);
    const id = await comment(dave, "Spam");
    await reply(bob, id, "Indeed");
    expect(await as(erin, () => hideContent("comment", id))).toEqual(OK);
    const [shown] = (await thread(bob)).comments;
    expect(shown.state).toBe("hidden");
    expect(shown.replies.map(({ body }) => body)).toEqual(["Indeed"]);
    expect(await as(erin, () => restoreContent("comment", id))).toEqual(OK);
  });

  it("outside one's community is NOT_FOUND: a reader, an invited or another author's moderator", async () => {
    const id = await comment(dave, "Text");
    await CommunityModerator.create({
      authorId: alice,
      userId: bob,
      state: "invited",
    });
    await makeModerator(erin, bob);
    for (const user of [bob, erin, dave]) {
      expect(await as(user, () => hideContent("comment", id))).toEqual(
        COMMENT_NOT_FOUND,
      );
    }
    await as(alice, () => hideContent("comment", id));
    expect(await as(erin, () => restoreContent("comment", id))).toEqual(
      COMMENT_NOT_FOUND,
    );
  });

  it("a moderator with an active global ban moderates nothing", async () => {
    await makeModerator(erin);
    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "x", by: alice } },
    );
    const id = await comment(dave, "Text");
    expect(await as(erin, () => hideContent("comment", id))).toEqual(
      COMMENT_NOT_FOUND,
    );
  });

  it("checks input, session and the comment's state", async () => {
    const id = await comment(dave, "Text");
    signInAs(alice);
    expect(await hideContent("post" as never, id)).toEqual(INVALID);
    expect(await hideContent("comment", "nope")).toEqual(INVALID);
    expect(await hideContent("comment", id, 5 as never)).toEqual(INVALID);
    expect(
      await hideContent("comment", id, "x".repeat(MAX_BAN_REASON_LENGTH + 1)),
    ).toEqual(
      error("INVALID_INPUT", "hideReasonTooLong", {
        max: String(MAX_BAN_REASON_LENGTH),
      }),
    );
    expect(
      await hideContent("comment", new Types.ObjectId().toString()),
    ).toEqual(COMMENT_NOT_FOUND);
    expect(await restoreContent("comment", id)).toEqual(COMMENT_NOT_FOUND);
    signInAs(null);
    expect(await hideContent("comment", id)).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    signInAs(dave);
    await deleteComment(id);
    expect(await as(alice, () => hideContent("comment", id))).toEqual(
      COMMENT_NOT_FOUND,
    );
  });

  it("hiding again changes nothing; the writer cannot edit a hidden comment", async () => {
    const id = await comment(dave, "Text");
    await as(alice, () => hideContent("comment", id, "First"));
    expect(await as(alice, () => hideContent("comment", id, "Second"))).toEqual(
      OK,
    );
    expect((await Comment.findById(id).lean())!.hidden!.reason).toBe("First");
    expect(await ModerationLog.countDocuments({ action: "hide" })).toBe(1);
    expect(await as(dave, () => editComment(id, "New"))).toEqual(
      COMMENT_NOT_FOUND,
    );
  });

  it("moderation steps share a per-account limit, half for a new account", async () => {
    const young = await createUser("Young", 1000);
    await makeModerator(young);
    const id = await comment(dave, "Text");
    signInAs(young);
    for (let i = 0; i < SOCIAL_LIMITS.moderate.max / 2; i++) {
      expect(await hideContent("comment", id)).toEqual(OK);
    }
    expect(await hideContent("comment", id)).toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
  });

  it("the thread offers the menu only where the viewer may use it", async () => {
    await makeModerator(erin);
    const fromDave = await comment(dave, "Dave");
    const fromErin = await comment(erin, "Erin");
    const fromAlice = await comment(alice, "Alice");
    const flags = async (viewer: Types.ObjectId) => {
      const { comments, moderatedAuthorId } = await thread(viewer);
      return {
        moderatedAuthorId,
        flags: Object.fromEntries(
          comments.map(({ id, canHide, canBan }) => [id, { canHide, canBan }]),
        ),
      };
    };
    expect(await flags(alice)).toEqual({
      moderatedAuthorId: alice.toString(),
      flags: {
        [fromDave]: { canHide: true, canBan: true },
        [fromErin]: { canHide: true, canBan: false },
        [fromAlice]: { canHide: false, canBan: false },
      },
    });
    expect(await flags(erin)).toEqual({
      moderatedAuthorId: alice.toString(),
      flags: {
        [fromDave]: { canHide: true, canBan: true },
        [fromErin]: { canHide: false, canBan: false },
        [fromAlice]: { canHide: false, canBan: false },
      },
    });
    expect((await flags(bob)).moderatedAuthorId).toBeNull();
    expect(
      Object.values((await flags(bob)).flags).every(
        ({ canHide, canBan }) => !canHide && !canBan,
      ),
    ).toBe(true);
  });
});

describe("a moderator does not moderate the author or moderators (criterion 2)", () => {
  it("refuses hiding and banning the author and another moderator", async () => {
    await makeModerator(erin);
    await makeModerator(bob);
    const byAlice = await comment(alice, "Author");
    const byBob = await comment(bob, "Moderator");
    signInAs(erin);
    expect(await hideContent("comment", byAlice)).toEqual(CANNOT_MODERATE);
    expect(await hideContent("comment", byBob)).toEqual(CANNOT_MODERATE);
    expect(
      await banFromCommunity(alice.toString(), "Alice", 7, "Reason"),
    ).toEqual(CANNOT_MODERATE);
    expect(
      await banFromCommunity(alice.toString(), "bob", 7, "Reason"),
    ).toEqual(CANNOT_MODERATE);
    expect(
      await banFromCommunity(alice.toString(), "Erin", 7, "Reason"),
    ).toEqual(CANNOT_MODERATE);
    expect(await CommunityBan.countDocuments()).toBe(0);
  });

  it("the author hides a moderator's comment, but bans only after removing the role", async () => {
    await makeModerator(erin);
    const byErin = await comment(erin, "Moderator");
    signInAs(alice);
    expect(await hideContent("comment", byErin)).toEqual(OK);
    expect(
      await banFromCommunity(alice.toString(), "Erin", 7, "Reason"),
    ).toEqual(CANNOT_MODERATE);
    expect(await removeModerator("Erin")).toEqual(OK);
    expect(
      await banFromCommunity(alice.toString(), "Erin", 7, "Reason"),
    ).toEqual(OK);
    expect(await hideContent("comment", await comment(alice, "Own"))).toEqual(
      CANNOT_MODERATE,
    );
  });
});

describe("bans (criterion 3)", () => {
  it("needs a reason within the limit and a known duration", async () => {
    signInAs(alice);
    const author = alice.toString();
    expect(await banFromCommunity(author, "Dave", 7, "   ")).toEqual(
      error("INVALID_INPUT", "banReasonRequired"),
    );
    expect(
      await banFromCommunity(
        author,
        "Dave",
        7,
        "x".repeat(MAX_BAN_REASON_LENGTH + 1),
      ),
    ).toEqual(
      error("INVALID_INPUT", "banReasonTooLong", {
        max: String(MAX_BAN_REASON_LENGTH),
      }),
    );
    expect(await banFromCommunity(author, "Dave", 3 as never, "x")).toEqual(
      INVALID,
    );
    expect(await banFromCommunity("nope", "Dave", 7, "x")).toEqual(INVALID);
    expect(await banFromCommunity(author, "Nobody", 7, "x")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await CommunityBan.countDocuments()).toBe(0);
  });

  it("someone else's community is NOT_FOUND, also for its moderator elsewhere", async () => {
    await seedBook(bob, "Bob's");
    await makeModerator(erin, bob);
    expect(
      await as(alice, () => banFromCommunity(bob.toString(), "Dave", 7, "x")),
    ).toEqual(COMMUNITY_NOT_FOUND);
    expect(
      await as(erin, () => banFromCommunity(alice.toString(), "Dave", 7, "x")),
    ).toEqual(COMMUNITY_NOT_FOUND);
    expect(
      await as(erin, () => liftCommunityBan(alice.toString(), "Dave")),
    ).toEqual(COMMUNITY_NOT_FOUND);
  });

  it("lasts until its end, then expires by itself; the banned user sees the reason", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-11-11T10:00:00Z");
    vi.setSystemTime(now);
    await makeModerator(erin);
    expect(
      await as(erin, () =>
        banFromCommunity(alice.toString(), "dave", 7, " Spam links "),
      ),
    ).toEqual(OK);
    const until = new Date(now.getTime() + 7 * DAY);
    expect(await CommunityBan.findOne({ userId: dave }).lean()).toMatchObject({
      authorId: alice,
      until,
      reason: "Spam links",
      by: erin,
    });
    expect(
      await canInteract(dave.toString(), {
        authorId: alice.toString(),
        kind: "comment",
      }),
    ).toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(
      await as(dave, () => addComment({ storyId: book.storyId }, "Hi")),
    ).toEqual(REFUSED);
    expect(await activeCommunityBan(dave.toString(), alice.toString())).toEqual(
      {
        nickname: "Alice",
        reason: "Spam links",
        until: until.toISOString(),
      },
    );
    expect(await activeCommunityBan(bob.toString(), alice.toString())).toBe(
      null,
    );
    expect(await activeCommunityBan(null, alice.toString())).toBe(null);
    expect(await listCommunityBans(alice.toString())).toMatchObject([
      { nickname: "Dave", reason: "Spam links", by: "Erin" },
    ]);

    vi.setSystemTime(new Date(until.getTime() + 1000));
    expect(
      await canInteract(dave.toString(), {
        authorId: alice.toString(),
        kind: "comment",
      }),
    ).toEqual({ ok: true });
    expect(await activeCommunityBan(dave.toString(), alice.toString())).toBe(
      null,
    );
    expect(await listCommunityBans(alice.toString())).toEqual([]);
  });

  it("a ban without end stays; a new ban replaces the old; lifting works at once", async () => {
    signInAs(alice);
    const author = alice.toString();
    expect(await banFromCommunity(author, "Dave", 1, "First")).toEqual(OK);
    expect(await banFromCommunity(author, "Dave", null, "Second")).toEqual(OK);
    expect(await CommunityBan.find({ userId: dave }).lean()).toMatchObject([
      { until: null, reason: "Second" },
    ]);
    expect(await liftCommunityBan(author, "dave")).toEqual(OK);
    expect(
      await canInteract(dave.toString(), { authorId: author, kind: "comment" }),
    ).toEqual({ ok: true });
    expect(await liftCommunityBan(author, "Dave")).toEqual(
      error("NOT_FOUND", "banNotFound"),
    );
  });

  it("the expiring ban has a TTL index; one without end is skipped by it", async () => {
    const indexes = await CommunityBan.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { until: 1 }, expireAfterSeconds: 0 }),
    );
  });
});

describe("moderators (criterion 4)", () => {
  it("an invitation needs acceptance; then the moderator resigns", async () => {
    signInAs(alice);
    expect(await inviteModerator("erin")).toEqual(OK);
    expect(await isModeratorOf(erin.toString(), alice.toString())).toBe(false);
    expect(await inviteModerator("Erin")).toEqual(OK);
    expect(await CommunityModerator.countDocuments()).toBe(1);
    expect(await getModerationOverview(erin.toString())).toEqual({
      communities: [],
      invitations: [{ authorId: alice.toString(), nickname: "Alice" }],
    });
    expect(await hasModerationAccess(erin.toString())).toBe(true);

    signInAs(erin);
    expect(await resignModerator(alice.toString())).toEqual(
      error("NOT_FOUND", "moderatorNotFound"),
    );
    expect(await acceptModeratorInvite(alice.toString())).toEqual(OK);
    expect(await isModeratorOf(erin.toString(), alice.toString())).toBe(true);
    expect(await acceptModeratorInvite(alice.toString())).toEqual(
      error("NOT_FOUND", "invitationNotFound"),
    );
    expect((await getModerationOverview(erin.toString())).communities).toEqual([
      { authorId: alice.toString(), nickname: "Alice", role: "moderator" },
    ]);
    expect(await resignModerator(alice.toString())).toEqual(OK);
    expect(await isModeratorOf(erin.toString(), alice.toString())).toBe(false);
    expect(await hasModerationAccess(erin.toString())).toBe(false);
  });

  it("declining and removing end the role or the invitation", async () => {
    signInAs(alice);
    await inviteModerator("Erin");
    await inviteModerator("Dave");
    expect(
      await as(erin, () => declineModeratorInvite(alice.toString())),
    ).toEqual(OK);
    expect(
      await as(dave, () => acceptModeratorInvite(alice.toString())),
    ).toEqual(OK);
    signInAs(alice);
    expect(await listModerators(alice.toString())).toEqual([
      { nickname: "Dave", state: "active" },
    ]);
    expect(await removeModerator("dave")).toEqual(OK);
    expect(await isModeratorOf(dave.toString(), alice.toString())).toBe(false);
    expect(await removeModerator("Dave")).toEqual(
      error("NOT_FOUND", "moderatorNotFound"),
    );
    // A moderator cannot remove anyone: only the author's own community counts.
    await makeModerator(erin);
    await makeModerator(bob);
    expect(await as(erin, () => removeModerator("Bob"))).toEqual(
      error("NOT_FOUND", "moderatorNotFound"),
    );
    expect(await as(dave, () => acceptModeratorInvite("nope"))).toEqual(
      INVALID,
    );
  });

  it("allows at most MAX_MODERATORS active and invited together", async () => {
    for (let i = 0; i < MAX_MODERATORS - 1; i++) {
      await CommunityModerator.create({
        authorId: alice,
        userId: await createUser(`Mod${i}`),
        state: i % 2 ? "active" : "invited",
      });
    }
    signInAs(alice);
    expect(await inviteModerator("Erin")).toEqual(OK);
    expect(await inviteModerator("Dave")).toEqual(
      error("INVALID_INPUT", "tooManyModerators", {
        max: String(MAX_MODERATORS),
      }),
    );
  });

  it("refuses oneself, unknown accounts, blocks and banned accounts", async () => {
    signInAs(alice);
    expect(await inviteModerator("Alice")).toEqual(REFUSED);
    expect(await inviteModerator("Nobody")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "x",
      by: alice,
    });
    expect(await inviteModerator("Dave")).toEqual(REFUSED);
    await User.updateOne(
      { _id: bob },
      { globalBan: { until: null, reason: "x", by: erin } },
    );
    expect(await inviteModerator("Bob")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await CommunityModerator.countDocuments()).toBe(0);
  });
});

describe("the log (criterion 5)", () => {
  it("records every step and shows it to the author only", async () => {
    const id = await comment(dave, "Text");
    signInAs(alice);
    await inviteModerator("Erin");
    await as(erin, () => acceptModeratorInvite(alice.toString()));
    await as(erin, () => hideContent("comment", id, "Rude"));
    await as(erin, () => restoreContent("comment", id));
    await as(erin, () => banFromCommunity(alice.toString(), "Dave", 1, "Spam"));
    await as(erin, () => liftCommunityBan(alice.toString(), "Dave"));
    await as(erin, () => resignModerator(alice.toString()));
    await as(alice, () => inviteModerator("Bob"));
    await as(bob, () => declineModeratorInvite(alice.toString()));
    await as(alice, () => inviteModerator("Bob"));
    await as(alice, () => removeModerator("Bob"));

    const log = await listModerationLog(alice.toString());
    expect(
      log.map(({ action, actor, target, reason }) => ({
        action,
        actor,
        target,
        reason,
      })),
    ).toEqual(
      [
        { action: "invite", actor: "Alice", target: "Erin", reason: null },
        { action: "accept", actor: "Erin", target: "Erin", reason: null },
        { action: "hide", actor: "Erin", target: "Dave", reason: "Rude" },
        { action: "restore", actor: "Erin", target: "Dave", reason: null },
        { action: "ban", actor: "Erin", target: "Dave", reason: "Spam" },
        { action: "unban", actor: "Erin", target: "Dave", reason: null },
        { action: "resign", actor: "Erin", target: "Erin", reason: null },
        { action: "invite", actor: "Alice", target: "Bob", reason: null },
        { action: "decline", actor: "Bob", target: "Bob", reason: null },
        { action: "invite", actor: "Alice", target: "Bob", reason: null },
        { action: "remove", actor: "Alice", target: "Bob", reason: null },
      ].reverse(),
    );
    expect(tabsFor("author")).toEqual([
      "hidden",
      "reports",
      "bans",
      "moderators",
      "log",
    ]);
    expect(tabsFor("moderator")).toEqual(["hidden", "reports", "bans"]);
  });

  it("lists hidden comments with their place for the panel", async () => {
    const id = await comment(dave, "Text");
    await as(alice, () => hideContent("comment", id, "Rude"));
    expect(await listHiddenComments(alice.toString())).toMatchObject([
      {
        id,
        writer: "Dave",
        body: "Text",
        reason: "Rude",
        hiddenBy: "Alice",
        path: `/p/Alice/book/one#comment-${id}`,
      },
    ]);
    expect(await listHiddenComments(bob.toString())).toEqual([]);
  });
});

describe("purge after 30 days (criterion 6)", () => {
  it("comments and reactions have TTL indexes on purgeAt", async () => {
    for (const model of [Comment, Reaction]) {
      expect(await model.collection.indexes()).toContainEqual(
        expect.objectContaining({
          key: { purgeAt: 1 },
          expireAfterSeconds: 0,
        }),
      );
    }
  });

  it("replies of a purged comment show under “comment deleted”, in date order", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // The placeholder is dated by its id, to the second.
    const at = (minute: number) =>
      vi.setSystemTime(new Date(`2026-11-11T10:0${minute}:00.500Z`));
    at(0);
    const older = await comment(erin, "Older");
    at(1);
    const purged = await comment(dave, "Hidden");
    at(2);
    await reply(bob, purged, "Reply stays");
    at(3);
    const newer = await comment(erin, "Newer");
    await as(alice, () => hideContent("comment", purged));
    // What the TTL monitor does: the document goes, without its replies or reactions.
    await Comment.collection.deleteOne({ _id: new Types.ObjectId(purged) });

    const { comments, total } = await thread(bob);
    expect(comments.map(({ id, state }) => [id, state])).toEqual([
      [newer, "visible"],
      [purged, "deleted"],
      [older, "visible"],
    ]);
    expect(comments[1]).toMatchObject({
      author: null,
      body: null,
      canHide: false,
      replies: [{ body: "Reply stays" }],
    });
    expect(total).toBe(3);
  });
});

describe("review fixes", () => {
  const globalBan = (user: Types.ObjectId) =>
    User.updateOne(
      { _id: user },
      { globalBan: { until: null, reason: "x", by: bob } },
    );

  it("accepting is refused like inviting: community ban, block, global ban", async () => {
    for (const [user, bar] of [
      [
        dave,
        () =>
          CommunityBan.create({
            authorId: alice,
            userId: dave,
            until: null,
            reason: "x",
            by: alice,
          }),
      ],
      [erin, () => Block.create({ blockerId: erin, blockedId: alice })],
      [bob, () => globalBan(bob)],
    ] as const) {
      await CommunityModerator.create({
        authorId: alice,
        userId: user,
        state: "invited",
      });
      await bar();
      expect(
        await as(user, () => acceptModeratorInvite(alice.toString())),
      ).toEqual(REFUSED);
      expect(await isModeratorOf(user.toString(), alice.toString())).toBe(
        false,
      );
    }
  });

  it("a ban withdraws the banned account's invitation", async () => {
    await CommunityModerator.create({
      authorId: alice,
      userId: dave,
      state: "invited",
    });
    expect(
      await as(alice, () => banFromCommunity(alice.toString(), "Dave", 1, "x")),
    ).toEqual(OK);
    expect(await CommunityModerator.countDocuments()).toBe(0);
  });

  it("a globally banned account has no panel, no sidebar entry and no role steps", async () => {
    await makeModerator(erin);
    await globalBan(erin);
    expect(await hasModerationAccess(erin.toString())).toBe(false);
    expect(await getModerationOverview(erin.toString())).toEqual({
      communities: [],
      invitations: [],
    });
    expect(await as(erin, () => resignModerator(alice.toString()))).toEqual(
      REFUSED,
    );
    expect(await hasModerationAccess(alice.toString())).toBe(true);
    await globalBan(alice);
    expect(await hasModerationAccess(alice.toString())).toBe(false);
    expect(await as(alice, () => removeModerator("Erin"))).toEqual(REFUSED);
    expect(await as(alice, () => inviteModerator("Dave"))).toEqual(REFUSED);
  });

  it("a moderator neither replaces nor lifts the author's ban; the author may do both", async () => {
    await makeModerator(erin);
    const author = alice.toString();
    await as(alice, () => banFromCommunity(author, "Dave", 7, "Author's"));
    expect(
      await as(erin, () => banFromCommunity(author, "Dave", 1, "Shorter")),
    ).toEqual(CANNOT_MODERATE);
    expect(await as(erin, () => liftCommunityBan(author, "Dave"))).toEqual(
      CANNOT_MODERATE,
    );
    expect((await CommunityBan.findOne({ userId: dave }).lean())!.reason).toBe(
      "Author's",
    );

    await as(erin, () => banFromCommunity(author, "Bob", 1, "Erin's"));
    expect(
      await as(alice, () => banFromCommunity(author, "Bob", 30, "Author's")),
    ).toEqual(OK);
    await as(erin, () => banFromCommunity(author, "Bob", 1, "x")).then(
      (result) => expect(result).toEqual(CANNOT_MODERATE),
    );
    expect(await as(alice, () => liftCommunityBan(author, "Bob"))).toEqual(OK);
    await as(erin, () => banFromCommunity(author, "Bob", 1, "Erin's"));
    expect(await as(erin, () => liftCommunityBan(author, "Bob"))).toEqual(OK);
  });

  it("an expired ban of the author can be replaced by a moderator", async () => {
    await makeModerator(erin);
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: new Date(Date.now() - 1000),
      reason: "Old",
      by: alice,
    });
    expect(
      await as(erin, () =>
        banFromCommunity(alice.toString(), "Dave", 1, "New"),
      ),
    ).toEqual(OK);
  });

  it("marks a chapter and a book read-only for an account banned there", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "x",
      by: alice,
    });
    for (const target of [
      { type: "story", id: book.storyId },
      { type: "folder", id: book.folderId },
    ] as const) {
      expect(await isBannedAt(dave.toString(), target)).toBe(true);
      expect(await isBannedAt(erin.toString(), target)).toBe(false);
      expect(await isBannedAt(null, target)).toBe(false);
    }
  });

  it("an orphan whose replies the viewer does not see shows no placeholder", async () => {
    const purged = await comment(dave, "Hidden");
    await reply(bob, purged, "Blocked reply");
    await Comment.collection.deleteOne({ _id: new Types.ObjectId(purged) });
    await Block.create({ blockerId: erin, blockedId: bob });
    expect((await thread(erin)).comments).toEqual([]);
    expect((await thread(dave)).comments).toHaveLength(1);
  });

  it("has the indexes of the orphan lookup and the hidden list", async () => {
    const indexes = await Comment.collection.indexes();
    for (const key of [
      { storyId: 1, parentId: 1 },
      { folderId: 1, storyId: 1, parentId: 1 },
    ]) {
      expect(indexes).toContainEqual(expect.objectContaining({ key }));
    }
    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: { authorId: 1, "hidden.at": -1 },
        partialFilterExpression: { hidden: { $exists: true } },
      }),
    );
  });
});
