import mongoose, { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCategoryModerator,
  adminHide,
  deleteCategory,
  liftGlobalBan,
  moveCategory,
  removeCategoryModerator,
  removeTag,
  saveCategory,
  saveTag,
  setAdminAdult,
  setGlobalBan,
} from "@/app/[locale]/(protected)/admin/actions";
import { resolveReport } from "@/app/[locale]/(protected)/moderation/actions";
import { GET as getAvatar } from "@/app/avatars/[id]/route";
import { GET as getCover } from "@/app/covers/[id]/route";
import { addComment } from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { createPost, createThread } from "@/app/[locale]/forums/actions";
import { report } from "@/app/[locale]/p/[nickname]/report-actions";
import { requireUser } from "@/lib/auth/session";
import { getPublicProfile } from "@/lib/profiles/queries";
import { Activity } from "@/lib/models/activity";
import { Avatar } from "@/lib/models/avatar";
import { Comment } from "@/lib/models/comment";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import { ModerationLog } from "@/lib/models/moderation-log";
import { Notification } from "@/lib/models/notification";
import { PredefinedTag } from "@/lib/models/predefined-tag";
import { Profile } from "@/lib/models/profile";
import { Ranking } from "@/lib/models/ranking";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import {
  getPublishedChapter,
  getPublishedFolder,
  listPublicTags,
  listRecentlyPublished,
  searchPublishedChapters,
} from "@/lib/publish/queries";
import {
  ADMIN_LOG_PAGE,
  isActiveAdmin,
  listAdminLog,
  listAdminQueue,
  listGlobalBans,
} from "@/lib/social/admin";
import { getCommentThread } from "@/lib/social/comments";
import { getFeed } from "@/lib/social/feed";
import {
  findCategoryPlace,
  forumRole,
  getThread,
  listForumCategories,
} from "@/lib/social/forums";
import { recordChaptersPublished } from "@/lib/social/activity";
import { listNotifications } from "@/lib/social/notification-list";
import { reportRecipients } from "@/lib/social/notify";
import { canInteract } from "@/lib/social/permissions";
import { getHomeRankings } from "@/lib/social/ranking-queries";
import { validatePredefinedTag } from "@/lib/tags/predefined";
import { savePredefinedTag } from "@/lib/tags/mutations";
import { listPredefinedTags } from "@/lib/tags/queries";
import en from "@/messages/en.json";
import * as forum008 from "@/migrations/008-forum-categories";
import { flushAfter } from "../setup/next-server";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const error = (
  code: string,
  key: keyof typeof en.errors,
  replace: Record<string, string> = {},
) => ({
  ok: false,
  error: code,
  message: Object.entries(replace).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, value),
    en.errors[key] as string,
  ),
});
const OK = { ok: true };
const ADMIN_NOT_FOUND = error("NOT_FOUND", "adminNotFound");

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let root: Types.ObjectId;
let other: Types.ObjectId;

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

async function as<T>(user: Types.ObjectId | null, run: () => Promise<T>) {
  signInAs(user);
  return run();
}

async function seedBook(
  author: Types.ObjectId,
  name: string,
  tags: string[] = [],
) {
  const folder = await Folder.create({
    userId: author,
    name,
    published: true,
    tags,
  });
  const chapter = await Story.create({
    userId: author,
    folderId: folder._id,
    title: "One",
    content: "Shared words",
    publication: "public",
    publishedAt: new Date(),
  });
  return { folderId: folder._id, storyId: chapter._id };
}

const banErin = (duration: 1 | 7 | 30 | null = 7) =>
  as(root, () => setGlobalBan("erin", duration, "Spam everywhere"));

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  root = await createUser("Root", { role: "admin" });
  other = await createUser("Other", { role: "admin" });
  signInAs(dave);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("access (criterion 1)", () => {
  const ACTIONS: [string, () => Promise<unknown>][] = [
    ["setGlobalBan", () => setGlobalBan("Erin", 7, "Reason")],
    ["liftGlobalBan", () => liftGlobalBan("Erin")],
    ["setAdminAdult", () => setAdminAdult("/p/Alice/book", true)],
    ["adminHide", () => adminHide("comment", new Types.ObjectId().toString())],
    [
      "saveCategory",
      () => saveCategory(null, { en: "New", pl: "Nowa" }, false),
    ],
    ["moveCategory", () => moveCategory("workshop", "up")],
    ["deleteCategory", () => deleteCategory("workshop")],
    ["addCategoryModerator", () => addCategoryModerator("workshop", "Dave")],
    [
      "removeCategoryModerator",
      () => removeCategoryModerator("workshop", "Dave"),
    ],
    ["saveTag", () => saveTag("horror", "Horror", "Horror")],
    ["removeTag", () => removeTag("horror")],
  ];

  it.each(ACTIONS)(
    "%s is NOT_FOUND for anyone but an admin",
    async (_, run) => {
      await forum008.up(mongoose.connection.db!);
      expect(await as(dave, run)).toEqual(ADMIN_NOT_FOUND);
      expect(await as(null, run)).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Signed out",
      });
      expect(await ModerationLog.countDocuments()).toBe(0);
    },
  );

  it("answers NOT_FOUND before looking at the input", async () => {
    signInAs(dave);
    expect(await setGlobalBan(1 as unknown as string, 2 as 1, "")).toEqual(
      ADMIN_NOT_FOUND,
    );
    expect(await saveCategory(null, { en: "", pl: "" }, false)).toEqual(
      ADMIN_NOT_FOUND,
    );
    expect(await adminHide("thread" as "post", "x")).toEqual(ADMIN_NOT_FOUND);
    expect(await setAdminAdult(null as unknown as string, true)).toEqual(
      ADMIN_NOT_FOUND,
    );
  });

  it("takes the role away from a globally banned admin", async () => {
    expect(await isActiveAdmin(root.toString())).toBe(true);
    expect(await isActiveAdmin(dave.toString())).toBe(false);
    await User.updateOne(
      { _id: root },
      { globalBan: { until: null, reason: "x", by: other, at: new Date() } },
    );
    expect(await isActiveAdmin(root.toString())).toBe(false);
    expect(await as(root, () => liftGlobalBan("Erin"))).toEqual(
      ADMIN_NOT_FOUND,
    );
  });
});

describe("global ban (criterion 2)", () => {
  it("needs a reason, a known account and never bans an admin", async () => {
    signInAs(root);
    expect(await setGlobalBan("Erin", 7, "  ")).toEqual(
      error("INVALID_INPUT", "banReasonRequired"),
    );
    expect(await setGlobalBan("Erin", 2 as 1, "x")).toEqual(
      error("INVALID_INPUT", "requestInvalid"),
    );
    expect(await setGlobalBan("Nobody", 7, "x")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await setGlobalBan("Other", 7, "x")).toEqual(
      error("FORBIDDEN", "cannotModerate"),
    );
    expect(await setGlobalBan("Root", 7, "x")).toEqual(
      error("FORBIDDEN", "cannotModerate"),
    );
    expect(await liftGlobalBan("Erin")).toEqual(
      error("NOT_FOUND", "banNotFound"),
    );
  });

  it("bans with a term and a reason, lists and lifts the ban", async () => {
    expect(await banErin(7)).toEqual(OK);
    const user = await User.findById(erin).lean();
    expect(user!.globalBan).toMatchObject({
      reason: "Spam everywhere",
      by: root,
    });
    expect(user!.globalBan!.until!.getTime() - Date.now()).toBeGreaterThan(
      6.9 * DAY,
    );
    expect(await listGlobalBans()).toMatchObject([
      { nickname: "Erin", reason: "Spam everywhere", by: "Root" },
    ]);
    expect(await as(root, () => liftGlobalBan("erin"))).toEqual(OK);
    expect((await User.findById(erin).lean())!.globalBan).toBeUndefined();
    expect(await listGlobalBans()).toEqual([]);
  });

  it("still lets the admin mark a banned author's chapter as 18+", async () => {
    const { storyId } = await seedBook(erin, "Erin book");
    await banErin(null);
    expect(
      await as(root, () => setAdminAdult("/p/Erin/erin-book/one", true)),
    ).toEqual(OK);
    expect((await Story.findById(storyId).lean())!.adult).toEqual({
      admin: true,
    });
  });

  it("takes every interaction away while it lasts", async () => {
    await banErin();
    expect(
      await canInteract(erin.toString(), {
        authorId: alice.toString(),
        kind: "comment",
      }),
    ).toMatchObject({ ok: false, error: "FORBIDDEN" });
    const { storyId } = await seedBook(alice, "Alice book");
    expect(
      await as(erin, () => addComment({ storyId: storyId.toString() }, "Hi")),
    ).toMatchObject({ ok: false, error: "FORBIDDEN" });
  });

  describe("hides the banned author's publications and content from others", () => {
    let book: { folderId: Types.ObjectId; storyId: Types.ObjectId };
    let avatarId: Types.ObjectId;
    let coverId: Types.ObjectId;

    beforeEach(async () => {
      book = await seedBook(erin, "Erin book", ["erintag"]);
      await Folder.collection.updateOne(
        { _id: book.folderId },
        { $set: { lastActivityAt: new Date() } },
      );
      avatarId = (
        await Avatar.create({
          userId: erin,
          data: Buffer.from("a"),
          size: 1,
          scores: { nsfl: 0, nsfw: 0, sfw: 1 },
          model: "m",
        })
      )._id;
      await Profile.create({ userId: erin, avatarId });
      coverId = (
        await Cover.create({
          userId: erin,
          folderId: book.folderId,
          data: Buffer.from("c"),
          size: 1,
          state: "rated",
        })
      )._id;
      await Folder.updateOne({ _id: book.folderId }, { coverId });
      await Follow.create({ followerId: dave, followeeId: erin });
      await Activity.create({
        actorId: erin,
        type: "chapterPublished",
        folderId: book.folderId,
        storyIds: [book.storyId],
      });
      const now = new Date();
      await Ranking.create([
        {
          _id: "weekly",
          items: [{ folderId: book.folderId, score: 3 }],
          computedAt: now,
        },
        { _id: "topRated", items: [], computedAt: now },
      ]);
      await as(erin, () =>
        addComment({ storyId: book.storyId.toString() }, "Erin's own comment"),
      );
      const alices = await seedBook(alice, "Alice book");
      await as(erin, () =>
        addComment({ storyId: alices.storyId.toString() }, "Erin on Alice"),
      );
      signInAs(dave);
    });

    async function visibleTo(viewer: Types.ObjectId | null) {
      signInAs(viewer);
      const alices = await Story.findOne({ userId: alice }).lean();
      const viewerId = viewer?.toString() ?? null;
      return {
        folder: (await getPublishedFolder("Erin", "erin-book")) !== null,
        chapter:
          (await getPublishedChapter("Erin", "erin-book", "one")) !== null,
        search: (await searchPublishedChapters("Shared", [])).some(
          ({ nickname }) => nickname === "Erin",
        ),
        tags: (await listPublicTags()).includes("erintag"),
        recent: (await listRecentlyPublished()).some(
          ({ nickname }) => nickname === "Erin",
        ),
        profile: (await getPublicProfile("Erin", viewerId)) !== null,
        feed: viewer
          ? (await getFeed(viewer.toString(), null)).entries.length > 0
          : null,
        rankings: (await getHomeRankings(viewerId)).weekly.length > 0,
        comments: (
          await getCommentThread(
            viewerId,
            {
              folderId: alices!.folderId.toString(),
              storyId: alices!._id.toString(),
            },
            null,
          )
        ).comments.length,
        avatar: (
          await getAvatar(new Request("http://x"), {
            params: Promise.resolve({ id: avatarId.toString() }),
          })
        ).status,
        cover: (
          await getCover(new Request("http://x"), {
            params: Promise.resolve({ id: coverId.toString() }),
          })
        ).status,
      };
    }

    const VISIBLE = {
      folder: true,
      chapter: true,
      search: true,
      tags: true,
      recent: true,
      profile: true,
      feed: true,
      rankings: true,
      comments: 1,
      avatar: 200,
      cover: 200,
    };
    const HIDDEN = {
      folder: false,
      chapter: false,
      search: false,
      tags: false,
      recent: false,
      profile: false,
      feed: false,
      rankings: false,
      comments: 0,
      avatar: 404,
      cover: 404,
    };

    it("for each read function, until the term ends", async () => {
      expect(await visibleTo(dave)).toEqual(VISIBLE);
      await banErin(1);
      expect(await visibleTo(dave)).toEqual(HIDDEN);
      expect(await visibleTo(null)).toEqual({ ...HIDDEN, feed: null });

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 1.1 * DAY);
      await Ranking.updateMany({}, { computedAt: new Date() });
      expect(await visibleTo(dave)).toEqual(VISIBLE);
    });

    it("but the banned author still sees their own book, profile and avatar", async () => {
      await banErin(null);
      const own = await visibleTo(erin);
      expect(own).toMatchObject({
        folder: true,
        chapter: true,
        profile: true,
        avatar: 200,
        cover: 200,
      });
    });

    it("comes back when the ban is lifted", async () => {
      await banErin(null);
      await as(root, () => liftGlobalBan("Erin"));
      expect(await visibleTo(dave)).toEqual(VISIBLE);
    });
  });

  it("hides the banned account's forum posts", async () => {
    await forum008.up(mongoose.connection.db!);
    const thread = await as(dave, () =>
      createThread({ category: "workshop" }, "Thread", "First"),
    );
    if (!thread.ok) throw new Error(thread.message);
    await as(erin, () => createPost(thread.id, "Erin's reply"));
    const bodies = async () =>
      (await getThread(dave.toString(), thread.id))!.posts.map(
        ({ body }) => body,
      );
    expect(await bodies()).toEqual(["First", "Erin's reply"]);
    await banErin();
    expect(await bodies()).toEqual(["First"]);
    expect(await as(erin, () => createPost(thread.id, "Again"))).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
  });
});

describe("report queue", () => {
  it("shows the admin's reports with the reporter, resolves them and hides content", async () => {
    const { storyId } = await seedBook(alice, "Alice book");
    const added = await as(alice, () =>
      addComment({ storyId: storyId.toString() }, "Author's comment"),
    );
    if (!added.ok) throw new Error(added.message);
    expect(
      await as(dave, () => report("comment", added.id, "spam", "")),
    ).toEqual(OK);
    signInAs(root);
    const [item] = await listAdminQueue();
    expect(item).toMatchObject({
      targetType: "comment",
      target: "Alice",
      reporter: "Dave",
      text: "Author's comment",
      canHide: true,
      path: `/p/Alice/alice-book/one#comment-${added.id}`,
    });

    expect(await as(dave, () => adminHide("comment", added.id))).toEqual(
      ADMIN_NOT_FOUND,
    );
    expect(await as(root, () => adminHide("comment", added.id))).toEqual(OK);
    expect((await Comment.findById(added.id).lean())!.hidden).toMatchObject({
      by: root,
    });
    expect((await listAdminQueue())[0]).toMatchObject({
      hidden: true,
      canHide: false,
    });
    expect(await as(root, () => resolveReport(item.id, "resolved"))).toEqual(
      OK,
    );
    expect(await listAdminQueue()).toEqual([]);
    expect(
      await ModerationLog.find({ action: { $in: ["hide", "resolve"] } })
        .select({ _id: 0, authorId: 1, scope: 1, action: 1 })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
    ).toEqual([
      { authorId: null, scope: "global", action: "hide" },
      { authorId: null, scope: "global", action: "resolve" },
    ]);
  });

  it("gives no address for a book readers cannot open", async () => {
    const { folderId } = await seedBook(alice, "Alice book");
    await as(dave, () => report("folder", folderId.toString(), "spam", ""));
    signInAs(root);
    expect((await listAdminQueue())[0]).toMatchObject({
      text: "Alice book",
      path: "/p/Alice/alice-book",
    });
    await Folder.updateOne({ _id: folderId }, { published: false });
    expect((await listAdminQueue())[0]).toMatchObject({
      text: "Alice book",
      path: null,
    });
    await Folder.updateOne(
      { _id: folderId },
      { published: true, deletedAt: new Date() },
    );
    expect((await listAdminQueue())[0]).toMatchObject({ text: null, path: null });
  });

  it("links the admins' report notification to the queue", async () => {
    const { storyId } = await seedBook(alice, "Alice book");
    const added = await as(alice, () =>
      addComment({ storyId: storyId.toString() }, "Author's comment"),
    );
    if (!added.ok) throw new Error(added.message);
    await as(dave, () => report("comment", added.id, "spam", ""));
    await flushAfter();
    expect(await Notification.countDocuments({ userId: root })).toBe(1);
    const [notification] = await listNotifications(root.toString());
    expect(notification.href).toBe("/admin?tab=reports");
  });
});

describe("forum categories (criterion 4)", () => {
  beforeEach(() => forum008.up(mongoose.connection.db!));

  const keys = async () => (await listForumCategories()).map(({ key }) => key);

  it("adds a category keyed by its English label, refusing a taken key", async () => {
    signInAs(root);
    expect(
      await saveCategory(null, { en: " Poetry  Corner ", pl: "Poezja" }, true),
    ).toEqual(OK);
    expect(await ForumCategory.findById("poetry-corner").lean()).toMatchObject({
      labels: { en: "Poetry  Corner", pl: "Poezja" },
      adminOnly: true,
    });
    expect((await keys()).at(-1)).toBe("poetry-corner");
    expect(
      await saveCategory(null, { en: "poetry corner", pl: "Inna" }, false),
    ).toEqual(error("INVALID_INPUT", "categoryKeyTaken"));
    expect(await saveCategory(null, { en: "T", pl: "T" }, false)).toEqual(
      error("INVALID_INPUT", "categoryKeyTaken"),
    );
    expect(await saveCategory(null, { en: "X", pl: " " }, false)).toEqual(
      error("INVALID_INPUT", "categoryLabelRequired"),
    );
  });

  it("refuses a key of dots and the key of a deleted category with threads", async () => {
    signInAs(root);
    expect(await saveCategory(null, { en: "...", pl: "Kropki" }, false)).toEqual(
      error("INVALID_INPUT", "categoryKeyTaken"),
    );
    const thread = await as(dave, () =>
      createThread({ category: "workshop" }, "Kept", "x"),
    );
    expect(thread).toMatchObject({ ok: true });
    await as(root, () => deleteCategory("workshop"));
    expect(
      await as(root, () =>
        saveCategory(null, { en: "Workshop", pl: "Warsztat" }, false),
      ),
    ).toEqual(error("INVALID_INPUT", "categoryKeyTaken"));
    expect(await as(root, () => moveCategory("feedback", "up"))).toEqual(OK);
    expect(
      await ModerationLog.findOne({ targetKey: "feedback" }).lean(),
    ).toMatchObject({ action: "move", targetType: "category" });
  });

  it("keeps at most 10 moderators in a category", async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, (_, index) => createUser(`Mod${index}`)),
    );
    await ForumCategory.updateOne({ _id: "workshop" }, { moderatorIds: ids });
    expect(
      await as(root, () => addCategoryModerator("workshop", "Dave")),
    ).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.tooManyModerators.replace("{max, number}", "10"),
    });
    expect(
      await as(root, () => addCategoryModerator("workshop", "Mod3")),
    ).toEqual(OK);
  });

  it("changes labels and adminOnly, moves and deletes also a starting category", async () => {
    signInAs(root);
    expect(
      await saveCategory("workshop", { en: "Workshop", pl: "Warsztat" }, true),
    ).toEqual(OK);
    expect(await findCategoryPlace("workshop")).toMatchObject({
      category: { labels: { en: "Workshop", pl: "Warsztat" }, adminOnly: true },
    });
    await saveCategory("workshop", { en: "Workshop", pl: "Warsztat" }, false);
    expect((await findCategoryPlace("workshop"))!.category.adminOnly).toBe(
      false,
    );
    expect(await saveCategory("nope", { en: "A", pl: "B" }, false)).toEqual(
      error("NOT_FOUND", "categoryNotFound"),
    );

    const before = await keys();
    expect(await moveCategory(before[1], "up")).toEqual(OK);
    expect(await keys()).toEqual([before[1], before[0], ...before.slice(2)]);

    const thread = await as(dave, () =>
      createThread({ category: "announcements" }, "T", "x"),
    );
    expect(thread).toMatchObject({ ok: false });
    const workshop = await as(dave, () =>
      createThread({ category: "workshop" }, "Kept", "x"),
    );
    if (!workshop.ok) throw new Error(workshop.message);
    expect(await as(root, () => deleteCategory("workshop"))).toEqual(OK);
    expect(await keys()).not.toContain("workshop");
    expect(await ForumThread.exists({ _id: workshop.id })).not.toBeNull();
    expect(await getThread(dave.toString(), workshop.id)).toBeNull();
    expect(await as(root, () => deleteCategory("workshop"))).toEqual(
      error("NOT_FOUND", "categoryNotFound"),
    );
  });

  it("adds and removes category moderators, who then moderate the forum", async () => {
    signInAs(root);
    const roleOfDave = async () =>
      forumRole(dave.toString(), (await findCategoryPlace("workshop"))!);
    expect(await roleOfDave()).toBeNull();
    expect(await addCategoryModerator("workshop", "dave")).toEqual(OK);
    expect(await roleOfDave()).toBe("categoryModerator");
    expect(await addCategoryModerator("workshop", "Nobody")).toEqual(
      error("NOT_FOUND", "userNotFound"),
    );
    expect(await addCategoryModerator("nope", "Dave")).toEqual(
      error("NOT_FOUND", "categoryNotFound"),
    );
    expect(await removeCategoryModerator("workshop", "Dave")).toEqual(OK);
    expect(await roleOfDave()).toBeNull();
    expect(await removeCategoryModerator("workshop", "Dave")).toEqual(
      error("NOT_FOUND", "moderatorNotFound"),
    );
  });
});

describe("predefined tags (criterion 5)", () => {
  beforeEach(async () => {
    await PredefinedTag.create({
      _id: "crime",
      labels: { en: "Crime", pl: "Kryminał" },
    });
  });

  it("saves and removes a tag", async () => {
    signInAs(root);
    expect(await saveTag("horror", " Horror ", "Groza")).toEqual(OK);
    expect(await listPredefinedTags()).toContainEqual({
      key: "horror",
      labels: { en: "Horror", pl: "Groza" },
    });
    expect(await removeTag("horror")).toEqual(OK);
    expect(await removeTag("horror")).toEqual(
      error("NOT_FOUND", "tagNotFound"),
    );
  });

  it.each([
    ["Horror", "Horror", "Groza"],
    ["mystery", "Mystery", "kryminał"],
    ["x", "X", " "],
    ["x", "X".repeat(31), "X"],
  ])(
    "refuses %s with the script's check",
    async (key, labels_en, labels_pl) => {
      const others = await listPredefinedTags();
      const expected = validatePredefinedTag(
        { key, labels: { en: labels_en.trim(), pl: labels_pl.trim() } },
        others,
      )!;
      expect(expected).not.toBeNull();
      expect(
        await savePredefinedTag({
          key,
          labels: { en: labels_en, pl: labels_pl },
        }),
      ).toEqual(expected);
      const result = await as(root, () => saveTag(key, labels_en, labels_pl));
      expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
      expect(await PredefinedTag.countDocuments()).toBe(1);
    },
  );

  it("names the clashing key in the panel's message", async () => {
    expect(
      await as(root, () => saveTag("mystery", "Mystery", "kryminał")),
    ).toEqual(error("INVALID_INPUT", "tagSpellingTaken", { key: "crime" }));
  });
});

describe("log (criterion 6)", () => {
  it("records every admin step for the whole site", async () => {
    await forum008.up(mongoose.connection.db!);
    await seedBook(alice, "Alice book");
    await PredefinedTag.deleteMany({});
    signInAs(root);
    await banErin();
    await liftGlobalBan("Erin");
    await setAdminAdult("/p/Alice/alice-book", true);
    await setAdminAdult("/p/Alice/alice-book/one", false);
    await setAdminAdult("/p/Alice/alice-book", null);
    await saveCategory(null, { en: "Poetry", pl: "Poezja" }, false);
    await addCategoryModerator("poetry", "Dave");
    await removeCategoryModerator("poetry", "Dave");
    await deleteCategory("poetry");
    await saveTag("horror", "Horror", "Groza");
    await removeTag("horror");
    const entries = await ModerationLog.find()
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(
      entries.every(
        ({ scope, authorId }) => scope === "global" && authorId === null,
      ),
    ).toBe(true);
    expect(
      entries.map(({ action, targetType }) => `${action}:${targetType}`),
    ).toEqual([
      "ban:user",
      "unban:user",
      "markAdult:folder",
      "unmarkAdult:story",
      "clearAdult:folder",
      "save:category",
      "addModerator:category",
      "removeModerator:category",
      "delete:category",
      "save:tag",
      "delete:tag",
    ]);
    expect(entries[0]).toMatchObject({
      targetUserId: erin,
      reason: "Spam everywhere",
    });
    expect(entries[2]).toMatchObject({ targetUserId: alice });
    expect(entries[6]).toMatchObject({
      targetKey: "poetry",
      targetUserId: dave,
    });
  });

  it("lists global and community entries, filtered by the community's author, in pages of 50", async () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 0, minutes));
    await ModerationLog.collection.insertMany([
      {
        authorId: null,
        scope: "global",
        actorId: root,
        action: "ban",
        targetType: "user",
        targetId: erin,
        targetUserId: erin,
        reason: "R",
        createdAt: at(1),
      },
      {
        authorId: alice,
        actorId: alice,
        action: "hide",
        targetType: "comment",
        targetId: new Types.ObjectId(),
        targetUserId: dave,
        createdAt: at(2),
      },
      ...Array.from({ length: ADMIN_LOG_PAGE }, (_, index) => ({
        authorId: dave,
        actorId: dave,
        action: "unban",
        targetType: "user",
        targetId: erin,
        targetUserId: erin,
        createdAt: at(10 + index),
      })),
    ]);
    const first = await listAdminLog({ page: 0 });
    expect(first.entries).toHaveLength(ADMIN_LOG_PAGE);
    expect(first.more).toBe(true);
    expect(first.entries[0]).toMatchObject({
      community: "Dave",
      actor: "Dave",
    });
    const second = await listAdminLog({ page: 1 });
    expect(second.more).toBe(false);
    expect(second.entries).toMatchObject([
      { action: "hide", community: "Alice", actor: "Alice", target: "Dave" },
      {
        action: "ban",
        community: null,
        actor: "Root",
        target: "Erin",
        reason: "R",
      },
    ]);
    expect(
      (await listAdminLog({ author: "alice", page: 0 })).entries,
    ).toMatchObject([{ action: "hide", community: "Alice" }]);
    expect(
      (await listAdminLog({ page: 1e9 })).entries,
    ).toEqual([]);
    expect(await listAdminLog({ author: "Nobody", page: 0 })).toEqual({
      entries: [],
      more: false,
    });
  });
});

describe("audit fixes (task 91)", () => {
  it("hides a post in the forum of a banned author or one without a public book", async () => {
    await forum008.up(mongoose.connection.db!);
    const { folderId } = await seedBook(erin, "Erin book");
    const thread = await as(dave, () =>
      createThread({ nickname: "Erin" }, "In Erin's forum", "First"),
    );
    if (!thread.ok) throw new Error(thread.message);
    const posts = await Promise.all(
      ["One", "Two"].map((body) => as(dave, () => createPost(thread.id, body))),
    );
    const [banned, unpublished] = posts.map((post) => {
      if (!post.ok) throw new Error(post.message);
      return post.id;
    });
    await banErin(null);
    expect(await as(root, () => adminHide("post", banned))).toEqual(OK);
    await as(root, () => liftGlobalBan("Erin"));
    await Folder.updateOne({ _id: folderId }, { $set: { published: false } });
    expect(await as(root, () => adminHide("post", unpublished))).toEqual(OK);
    await expect(
      ForumPost.countDocuments({ hidden: { $exists: true } }),
    ).resolves.toBe(2);
  });

  it("makes no feed entry nor notification of a banned author's new chapters", async () => {
    const { folderId, storyId } = await seedBook(erin, "Erin book");
    await Follow.create({ followerId: dave, followeeId: erin });
    await banErin(null);
    await recordChaptersPublished(erin, folderId, [storyId]);
    await flushAfter();
    await expect(Activity.countDocuments({ actorId: erin })).resolves.toBe(0);
    await expect(Notification.countDocuments({ userId: dave })).resolves.toBe(
      0,
    );
  });

  it("does not send a report to a globally banned or deleted author or moderator", async () => {
    await CommunityModerator.create([
      { authorId: alice, userId: erin, state: "active" },
      { authorId: alice, userId: other, state: "active" },
    ]);
    await User.updateOne({ _id: other }, { $set: { deletedAt: new Date() } });
    await banErin(null);
    expect(
      (
        await reportRecipients({ authorId: alice, targetUserId: dave })
      ).map(String),
    ).toEqual([alice.toString()]);
    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "x", by: root, at: new Date() } },
    );
    expect(
      await reportRecipients({ authorId: alice, targetUserId: dave }),
    ).toEqual([]);
  });
});
