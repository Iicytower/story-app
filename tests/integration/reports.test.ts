import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hideContent,
  resolveReport,
} from "@/app/[locale]/(protected)/moderation/actions";
import {
  addComment,
  deleteComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_REPORT_LENGTH } from "@/lib/limits";
import { Block } from "@/lib/models/block";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Folder } from "@/lib/models/folder";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Report } from "@/lib/models/report";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import {
  listAdminReports,
  listCommunityReports,
  listModerationLog,
} from "@/lib/social/moderation";
import en from "@/messages/en.json";
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
const OK = { ok: true };
const INVALID = error("INVALID_INPUT", "requestInvalid");
const TARGET_NOT_FOUND = error("NOT_FOUND", "reportTargetNotFound");
const REPORT_NOT_FOUND = error("NOT_FOUND", "reportNotFound");
const DUPLICATE = error("INVALID_INPUT", "reportAlreadyOpen");
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");

let alice: Types.ObjectId;
let bob: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let frank: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string, extra: object = {}) {
  const { insertedId } = await User.collection.insertOne({
    nickname,
    passwordHash: "x",
    createdAt: new Date(Date.now() - 2 * DAY),
    ...extra,
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

const as = <T>(user: Types.ObjectId, run: () => Promise<T>) => {
  signInAs(user);
  return run();
};

async function seedBook(author: Types.ObjectId, name = "Book") {
  const folder = await Folder.create({ userId: author, name, published: true });
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
  by: Types.ObjectId,
  body: string,
  storyId = book.storyId,
) {
  const result = await as(by, () => addComment({ storyId }, body));
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

const reportComment = (by: Types.ObjectId, id: string, details = "") =>
  as(by, () => report("comment", id, "spam", details));

async function onlyReport() {
  const reports = await Report.find().lean();
  expect(reports).toHaveLength(1);
  return reports[0];
}

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  frank = await createUser("Frank", { role: "admin" });
  book = await seedBook(alice);
  await CommunityModerator.create({
    authorId: alice,
    userId: bob,
    state: "active",
  });
});

describe("report", () => {
  it("sends a comment in the author's community to the author, the rest to the admin", async () => {
    const erins = await comment(erin, "Buy cheap stuff");
    expect(await reportComment(dave, erins, "  links  ")).toEqual(OK);
    expect(await onlyReport()).toMatchObject({
      reporterId: dave,
      targetType: "comment",
      targetUserId: erin,
      route: "author",
      authorId: alice,
      reason: "spam",
      details: "links",
      state: "open",
    });
    await Report.deleteMany({});

    // The author's own content is for the admin (D80).
    const alices = await comment(alice, "Thanks for reading");
    const targets = [
      ["comment", alices, alice],
      ["story", book.storyId, alice],
      ["folder", book.folderId, alice],
      ["profile", "eRIN", erin],
    ] as const;
    for (const [targetType, target, owner] of targets) {
      expect(
        await as(dave, () => report(targetType, target, "harassment", "")),
      ).toEqual(OK);
      const saved = await Report.findOne({ targetType }).lean();
      expect(saved).toMatchObject({ route: "admin", targetUserId: owner });
      expect(saved!.authorId).toBeUndefined();
    }
  });

  it("refuses bad input and too long details", async () => {
    const erins = await comment(erin, "Hello");
    signInAs(dave);
    expect(await report("thread" as never, erins, "spam", "")).toEqual(INVALID);
    expect(
      await report("comment", erins, "rude" as unknown as "spam", ""),
    ).toEqual(INVALID);
    expect(await report("comment", "nope", "spam", "")).toEqual(INVALID);
    expect(
      await report("comment", erins, "spam", 5 as unknown as string),
    ).toEqual(INVALID);
    expect(
      await report("comment", erins, "spam", "x".repeat(MAX_REPORT_LENGTH + 1)),
    ).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.reportTooLong.replace(
        "{max, number}",
        MAX_REPORT_LENGTH.toLocaleString("en"),
      ),
    });
    signInAs(null);
    expect(await report("comment", erins, "spam", "")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await Report.countDocuments()).toBe(0);
  });

  it("does not report what the reporter cannot see, nor their own content", async () => {
    const hidden = await comment(erin, "Hidden one");
    expect(await as(alice, () => hideContent("comment", hidden))).toEqual(OK);
    expect(await reportComment(dave, hidden)).toEqual(TARGET_NOT_FOUND);

    const deleted = await comment(erin, "Gone");
    expect(await as(erin, () => deleteComment(deleted))).toEqual(OK);
    expect(await reportComment(dave, deleted)).toEqual(TARGET_NOT_FOUND);

    const draft = await Story.create({
      userId: alice,
      folderId: book.folderId,
      title: "Draft",
      content: "x",
    });
    signInAs(dave);
    expect(await report("story", draft._id.toString(), "spam", "")).toEqual(
      TARGET_NOT_FOUND,
    );
    expect(
      await report("story", new Types.ObjectId().toString(), "spam", ""),
    ).toEqual(TARGET_NOT_FOUND);
    expect(await report("profile", "Nobody", "spam", "")).toEqual(
      TARGET_NOT_FOUND,
    );

    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "x", by: frank } },
    );
    expect(await report("profile", "Erin", "spam", "")).toEqual(
      TARGET_NOT_FOUND,
    );

    const own = await comment(dave, "Mine");
    expect(await reportComment(dave, own)).toEqual(REFUSED);
    signInAs(alice);
    expect(await report("story", book.storyId, "spam", "")).toEqual(REFUSED);
    expect(await report("folder", book.folderId, "spam", "")).toEqual(REFUSED);
    expect(await report("profile", "Alice", "spam", "")).toEqual(REFUSED);
    expect(await Report.countDocuments()).toBe(0);
  });

  it("a reporter who blocked the author does not see the content", async () => {
    const erins = await comment(erin, "Hello");
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await reportComment(dave, erins)).toEqual(TARGET_NOT_FOUND);
    expect(
      await as(dave, () => report("story", book.storyId, "spam", "")),
    ).toEqual(TARGET_NOT_FOUND);
  });

  it("a profile the reporter blocked is not there to report", async () => {
    await Block.create({ blockerId: dave, blockedId: erin });
    expect(await as(dave, () => report("profile", "Erin", "spam", ""))).toEqual(
      TARGET_NOT_FOUND,
    );
    // Blocked by the profile's owner, the reporter still reports it.
    await Block.create({ blockerId: alice, blockedId: dave });
    expect(
      await as(dave, () => report("profile", "Alice", "spam", "")),
    ).toEqual(OK);
  });

  it("the writer blocked by the reporter is hidden from them too", async () => {
    const erins = await comment(erin, "Hello");
    await Block.create({ blockerId: dave, blockedId: erin });
    expect(await reportComment(dave, erins)).toEqual(TARGET_NOT_FOUND);
  });

  it("a block by the author, a community ban and a global ban do not stop a report", async () => {
    const erins = await comment(erin, "Hello");
    await Block.create({ blockerId: alice, blockedId: dave });
    expect(await reportComment(dave, erins)).toEqual(OK);

    await Report.deleteMany({});
    await Block.deleteMany({});
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "x",
      by: alice,
    });
    expect(await reportComment(dave, erins)).toEqual(OK);

    await Report.deleteMany({});
    await User.updateOne(
      { _id: dave },
      { globalBan: { until: null, reason: "x", by: frank } },
    );
    expect(await reportComment(dave, erins)).toEqual(OK);
    expect(
      await as(dave, () => report("story", book.storyId, "spam", "")),
    ).toEqual(OK);
  });

  it("one open report of an object per person; a new one after the decision", async () => {
    const erins = await comment(erin, "Hello");
    expect(await reportComment(dave, erins)).toEqual(OK);
    expect(await reportComment(dave, erins)).toEqual(DUPLICATE);
    // Someone else reports it too.
    expect(await reportComment(bob, erins)).toEqual(OK);
    expect(await Report.countDocuments()).toBe(2);

    const first = await Report.findOne({ reporterId: dave }).lean();
    expect(
      await as(alice, () => resolveReport(first!._id.toString(), "dismissed")),
    ).toEqual(OK);
    expect(await reportComment(dave, erins)).toEqual(OK);
    expect(await Report.countDocuments({ reporterId: dave })).toBe(2);
  });

  it("allows 20 reports a day", async () => {
    const erins = await comment(erin, "Hello");
    for (let i = 0; i < SOCIAL_LIMITS.reportDay.max - 1; i++) {
      expect(
        await takeUserAttempt(SOCIAL_LIMITS.reportDay, dave.toString()),
      ).not.toBeNull();
    }
    expect(await reportComment(dave, erins)).toEqual(OK);
    expect(
      await as(dave, () => report("story", book.storyId, "spam", "")),
    ).toEqual(error("RATE_LIMITED", "tooManyAttempts"));
  });
});

describe("resolveReport", () => {
  async function openReport(writer = erin, reporter = dave) {
    const id = await comment(writer, `By ${writer.toString()}`);
    expect(await reportComment(reporter, id, "why")).toEqual(OK);
    const saved = await Report.findOne({ targetId: id }).lean();
    return { commentId: id, reportId: saved!._id.toString() };
  }

  it("the author and the moderators see only their community's reports", async () => {
    const { commentId, reportId } = await openReport();
    const bobsBook = await seedBook(bob, "Bob's");
    const elsewhere = await comment(erin, "Elsewhere", bobsBook.storyId);
    expect(await reportComment(dave, elsewhere)).toEqual(OK);
    expect(
      await as(dave, () => report("story", book.storyId, "spam", "")),
    ).toEqual(OK);

    const view = {
      id: reportId,
      writer: "Erin",
      reason: "spam",
      details: "why",
      comment: {
        id: commentId,
        body: `By ${erin.toString()}`,
        state: "visible",
        canHide: true,
        canBan: true,
      },
    };
    const alices = await listCommunityReports(
      alice.toString(),
      alice.toString(),
    );
    expect(alices).toHaveLength(1);
    expect(alices[0]).toMatchObject(view);
    expect(alices[0].comment!.path).toBe(
      `/p/Alice/book/one#comment-${commentId}`,
    );
    // The reporter is not shown to the community.
    expect(JSON.stringify(alices)).not.toContain("Dave");
    expect(
      await listCommunityReports(bob.toString(), alice.toString()),
    ).toMatchObject([view]);
    expect(
      (await listCommunityReports(bob.toString(), bob.toString())).map(
        ({ writer }) => writer,
      ),
    ).toEqual(["Erin"]);
  });

  it("outsiders, other authors and the admin get NOT_FOUND for a community's report", async () => {
    const { reportId } = await openReport();
    await seedBook(erin, "Erin's");
    for (const user of [dave, erin, frank]) {
      expect(await as(user, () => resolveReport(reportId, "resolved"))).toEqual(
        REPORT_NOT_FOUND,
      );
    }
    // A former moderator.
    await CommunityModerator.deleteMany({});
    expect(await as(bob, () => resolveReport(reportId, "resolved"))).toEqual(
      REPORT_NOT_FOUND,
    );
    // A moderator banned globally loses the role.
    await CommunityModerator.create({
      authorId: alice,
      userId: bob,
      state: "active",
    });
    await User.updateOne(
      { _id: bob },
      { globalBan: { until: null, reason: "x", by: frank } },
    );
    expect(await as(bob, () => resolveReport(reportId, "resolved"))).toEqual(
      REPORT_NOT_FOUND,
    );
    expect(await Report.findById(reportId).lean()).toMatchObject({
      state: "open",
    });
    expect(await ModerationLog.countDocuments()).toBe(0);
  });

  it("saves the outcome and a log entry; a decided report cannot be decided again", async () => {
    const resolved = await openReport();
    expect(
      await as(bob, () => resolveReport(resolved.reportId, "resolved")),
    ).toEqual(OK);
    const saved = await Report.findById(resolved.reportId).lean();
    expect(saved).toMatchObject({ state: "resolved", resolvedBy: bob });
    expect(saved!.resolvedAt).toBeInstanceOf(Date);
    expect(
      await as(alice, () => resolveReport(resolved.reportId, "dismissed")),
    ).toEqual(REPORT_NOT_FOUND);

    const dismissed = await openReport(dave, erin);
    expect(
      await as(alice, () => resolveReport(dismissed.reportId, "dismissed")),
    ).toEqual(OK);
    expect(await Report.findById(dismissed.reportId).lean()).toMatchObject({
      state: "dismissed",
      resolvedBy: alice,
    });

    expect(
      await ModerationLog.find().sort({ createdAt: 1, _id: 1 }).lean(),
    ).toMatchObject([
      {
        authorId: alice,
        actorId: bob,
        action: "resolve",
        targetType: "report",
        targetId: new Types.ObjectId(resolved.reportId),
        targetUserId: erin,
      },
      {
        authorId: alice,
        actorId: alice,
        action: "dismiss",
        targetType: "report",
        targetUserId: dave,
      },
    ]);
    expect(
      (await listModerationLog(alice.toString())).map(
        ({ action, actor, target }) => ({ action, actor, target }),
      ),
    ).toEqual([
      { action: "dismiss", actor: "Alice", target: "Dave" },
      { action: "resolve", actor: "Bob", target: "Erin" },
    ]);
    expect(
      await listCommunityReports(alice.toString(), alice.toString()),
    ).toEqual([]);
  });

  it("refuses bad input", async () => {
    const { reportId } = await openReport();
    signInAs(alice);
    expect(await resolveReport("nope", "resolved")).toEqual(INVALID);
    expect(
      await resolveReport(reportId, "maybe" as unknown as "resolved"),
    ).toEqual(INVALID);
    expect(
      await resolveReport(new Types.ObjectId().toString(), "resolved"),
    ).toEqual(REPORT_NOT_FOUND);
  });

  it("the admin decides reports outside communities, logged as global", async () => {
    expect(
      await as(dave, () =>
        report("folder", book.folderId, "unmarkedAdult", ""),
      ),
    ).toEqual(OK);
    const { reportId } = await openReport();
    const queue = await listAdminReports();
    expect(queue).toMatchObject([
      {
        targetType: "folder",
        targetId: book.folderId,
        target: "Alice",
        reporter: "Dave",
        reason: "unmarkedAdult",
      },
    ]);
    const adminReport = queue[0].id;
    // The community's author does not decide the admin's reports.
    expect(
      await as(alice, () => resolveReport(adminReport, "resolved")),
    ).toEqual(REPORT_NOT_FOUND);
    expect(
      await as(frank, () => resolveReport(adminReport, "resolved")),
    ).toEqual(OK);
    expect(
      await ModerationLog.findOne({ targetId: adminReport }).lean(),
    ).toMatchObject({
      authorId: null,
      scope: "global",
      actorId: frank,
      action: "resolve",
      targetUserId: alice,
    });
    expect(await listAdminReports()).toEqual([]);
    // The community's report stays the community's.
    expect(await Report.findById(reportId).lean()).toMatchObject({
      state: "open",
    });
  });

  it("the panel shows a reported comment hidden or deleted afterwards", async () => {
    const hidden = await openReport();
    expect(
      await as(bob, () => hideContent("comment", hidden.commentId)),
    ).toEqual(OK);
    const gone = await openReport(bob, dave);
    expect(await as(bob, () => deleteComment(gone.commentId))).toEqual(OK);
    const views = await listCommunityReports(
      alice.toString(),
      alice.toString(),
    );
    expect(
      views.find(({ id }) => id === hidden.reportId)!.comment,
    ).toMatchObject({ state: "hidden", canHide: false, canBan: true });
    expect(views.find(({ id }) => id === gone.reportId)).toMatchObject({
      writer: "Bob",
      comment: null,
    });
    // The author hides a moderator's comment but bans only after taking the role away.
    const bobs = await openReport(bob, erin);
    const forAlice = await listCommunityReports(
      alice.toString(),
      alice.toString(),
    );
    expect(
      forAlice.find(({ id }) => id === bobs.reportId)!.comment,
    ).toMatchObject({ canHide: true, canBan: false });
    expect(
      await as(alice, () => resolveReport(gone.reportId, "resolved")),
    ).toEqual(OK);
  });

  it("a moderator neither sees nor decides reports about themselves or another moderator", async () => {
    const carl = await createUser("Carl");
    await CommunityModerator.create({
      authorId: alice,
      userId: carl,
      state: "active",
    });
    const aboutBob = await openReport(bob, dave);
    const aboutCarl = await openReport(carl, dave);
    const aboutErin = await openReport(erin, dave);
    const ids = async (viewer: Types.ObjectId) =>
      (await listCommunityReports(viewer.toString(), alice.toString()))
        .map(({ id }) => id)
        .sort();
    expect(await ids(bob)).toEqual([aboutErin.reportId]);
    expect(await ids(alice)).toEqual(
      [aboutBob.reportId, aboutCarl.reportId, aboutErin.reportId].sort(),
    );
    expect(await ids(dave)).toEqual([]);
    for (const { reportId } of [aboutBob, aboutCarl]) {
      expect(await as(bob, () => resolveReport(reportId, "resolved"))).toEqual(
        REPORT_NOT_FOUND,
      );
    }
    expect(
      await as(bob, () => resolveReport(aboutErin.reportId, "resolved")),
    ).toEqual(OK);
    // The author decides reports about moderators.
    expect(
      await as(alice, () => resolveReport(aboutBob.reportId, "dismissed")),
    ).toEqual(OK);
  });
});
