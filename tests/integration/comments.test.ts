import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setFolderCommentsDisabled } from "@/app/[locale]/(protected)/books/actions";
import {
  moveStory,
  setStoryCommentsDisabled,
} from "@/app/[locale]/(protected)/chapters/actions";
import {
  addComment,
  deleteComment,
  editComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { requireUser } from "@/lib/auth/session";
import { MAX_COMMENT_LENGTH } from "@/lib/limits";
import { Activity } from "@/lib/models/activity";
import { Block } from "@/lib/models/block";
import { Comment } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { RateLimit } from "@/lib/models/rate-limit";
import { ReaderMark } from "@/lib/models/reader-mark";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { purgeSocialData } from "@/lib/social/cascade";
import {
  COMMENT_EDIT_MS,
  COMMENTS_PAGE_SIZE,
  MAX_REPLIES_SHOWN,
  countBookComments,
  getCommentThread,
  parseCommentsCursor,
} from "@/lib/social/comments";
import { getFeed } from "@/lib/social/feed";
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
const TARGET_NOT_FOUND = error("NOT_FOUND", "commentTargetNotFound");
const COMMENT_NOT_FOUND = error("NOT_FOUND", "commentNotFound");
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");
const DISABLED = error("FORBIDDEN", "commentsDisabled");
const RATE_LIMITED = error("RATE_LIMITED", "tooManyAttempts");

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;

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

let book: { folderId: string; storyId: string };
const chapterPlace = () => ({ storyId: book.storyId });
const bookPlace = () => ({ folderId: book.folderId });
const chapterThread = (viewer: Types.ObjectId | null) =>
  getCommentThread(viewer?.toString() ?? null, book, null);
const bookThread = (viewer: Types.ObjectId | null) =>
  getCommentThread(
    viewer?.toString() ?? null,
    { folderId: book.folderId, storyId: null },
    null,
  );

async function comment(
  as: Types.ObjectId,
  body: string,
  place: { storyId: string } | { folderId: string } = chapterPlace(),
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

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  book = await seedBook();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adding and reading (criterion 1)", () => {
  it("adds a comment and a reply under a chapter; a guest reads them", async () => {
    const id = await comment(dave, "Lovely **chapter**");
    const replyId = await reply(erin, id, "Agreed");
    const stored = await Comment.findById(id).lean();
    expect(stored).toMatchObject({
      authorId: alice,
      userId: dave,
      folderId: new Types.ObjectId(book.folderId),
      storyId: new Types.ObjectId(book.storyId),
      parentId: null,
      body: "Lovely **chapter**",
    });

    const thread = await chapterThread(null);
    expect(thread).toMatchObject({ disabled: false, total: 2, next: null });
    expect(thread.comments).toEqual([
      expect.objectContaining({
        id,
        state: "visible",
        author: { nickname: "Dave", avatar: null },
        body: "Lovely **chapter**",
        edited: false,
        own: false,
        editableUntil: null,
        replies: [
          expect.objectContaining({ id: replyId, body: "Agreed", own: false }),
        ],
      }),
    ]);
    // A guest's view carries no user ids.
    expect(JSON.stringify(thread)).not.toContain(dave.toString());
    const own = await chapterThread(dave);
    expect(own.comments[0]).toMatchObject({ own: true });
    expect(own.comments[0].editableUntil).not.toBeNull();
  });

  it("adds a comment and a reply in the thread under the book's contents", async () => {
    const id = await comment(dave, "On the book", bookPlace());
    await reply(alice, id, "Thanks");
    expect(await Comment.findById(id).lean()).toMatchObject({ storyId: null });
    const thread = await bookThread(null);
    expect(thread.total).toBe(2);
    expect(thread.comments[0].replies).toHaveLength(1);
    expect((await chapterThread(null)).total).toBe(0);
    const counts = await countBookComments(null, book.folderId, [book.storyId]);
    expect(counts.get(null)).toBe(2);
    expect(counts.get(book.storyId)).toBeUndefined();
  });

  it("a reply to a reply joins the same top-level comment", async () => {
    const id = await comment(dave, "Top");
    const first = await reply(erin, id, "First");
    const second = await reply(dave, first, "Second");
    expect(await Comment.findById(second).lean()).toMatchObject({
      parentId: new Types.ObjectId(id),
    });
    const [top] = (await chapterThread(null)).comments;
    expect(top.replies.map(({ body }) => body)).toEqual(["First", "Second"]);
  });

  it("pages top-level comments by 50 from the newest", async () => {
    const start = Date.now() - 1000 * 60;
    await Comment.insertMany(
      Array.from({ length: COMMENTS_PAGE_SIZE + 2 }, (_, i) => ({
        authorId: alice,
        userId: dave,
        folderId: book.folderId,
        storyId: book.storyId,
        parentId: null,
        body: `c${i}`,
        createdAt: new Date(start + i * 1000),
      })),
    );
    const first = await chapterThread(null);
    expect(first.comments).toHaveLength(COMMENTS_PAGE_SIZE);
    expect(first.comments[0].body).toBe(`c${COMMENTS_PAGE_SIZE + 1}`);
    const second = await getCommentThread(
      null,
      book,
      parseCommentsCursor(first.next),
    );
    expect(second.comments.map(({ body }) => body)).toEqual(["c1", "c0"]);
    expect(second.next).toBeNull();
  });

  it("shows up to 100 replies of each comment, whatever the others have", async () => {
    const busy = await comment(dave, "Busy");
    const quiet = await comment(erin, "Quiet");
    const start = Date.now() - 1000 * 60 * 60;
    await Comment.insertMany(
      Array.from({ length: MAX_REPLIES_SHOWN + 5 }, (_, i) => ({
        authorId: alice,
        userId: erin,
        folderId: book.folderId,
        storyId: book.storyId,
        parentId: busy,
        body: `r${i}`,
        createdAt: new Date(start + i * 1000),
      })),
    );
    await reply(dave, quiet, "Late reply");
    const thread = await chapterThread(null);
    const byId = new Map(thread.comments.map((c) => [c.id, c]));
    expect(byId.get(busy)!.replies).toHaveLength(MAX_REPLIES_SHOWN);
    expect(byId.get(quiet)!.replies.map(({ body }) => body)).toEqual([
      "Late reply",
    ]);
  });

  it("refuses a guest", async () => {
    signInAs(null);
    expect(await addComment(chapterPlace(), "Hi")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("refuses ids from the client that are not ids", async () => {
    signInAs(dave);
    const invalid = error("INVALID_INPUT", "requestInvalid");
    expect(await addComment({ storyId: "x" }, "Hi")).toEqual(invalid);
    expect(
      await addComment(
        { userId: dave } as unknown as { storyId: string },
        "Hi",
      ),
    ).toEqual(invalid);
    expect(await replyToComment("x", "Hi")).toEqual(invalid);
  });
});

describe("editing and deleting (criterion 2)", () => {
  it("edits one's own comment within 15 minutes and marks it edited", async () => {
    const id = await comment(dave, "Typo");
    expect(await editComment(id, "Fixed")).toEqual({ ok: true });
    const [shown] = (await chapterThread(null)).comments;
    expect(shown).toMatchObject({ body: "Fixed", edited: true });
  });

  it("refuses editing after 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const id = await comment(dave, "Typo");
    vi.setSystemTime(Date.now() + COMMENT_EDIT_MS + 1000);
    expect(await editComment(id, "Fixed")).toEqual(
      error("FORBIDDEN", "commentEditExpired"),
    );
    expect((await chapterThread(dave)).comments[0].editableUntil).toBeNull();
    expect(await deleteComment(id)).toEqual({ ok: true });
  });

  it("someone else's comment cannot be edited or deleted (isolation)", async () => {
    const id = await comment(dave, "Mine");
    signInAs(erin);
    expect(await editComment(id, "Yours")).toEqual(COMMENT_NOT_FOUND);
    expect(await deleteComment(id)).toEqual(COMMENT_NOT_FOUND);
    signInAs(alice);
    expect(await editComment(id, "Author")).toEqual(COMMENT_NOT_FOUND);
    expect(await Comment.findById(id).lean()).toMatchObject({ body: "Mine" });
  });

  it("deleting a comment with replies leaves “comment deleted”", async () => {
    const id = await comment(dave, "Secret text");
    const replyId = await reply(erin, id, "Reply");
    signInAs(dave);
    expect(await deleteComment(id)).toEqual({ ok: true });
    const thread = await chapterThread(null);
    expect(thread.total).toBe(1);
    expect(thread.comments).toEqual([
      expect.objectContaining({
        id,
        state: "deleted",
        author: null,
        body: null,
        replies: [expect.objectContaining({ id: replyId })],
      }),
    ]);
    expect(JSON.stringify(thread)).not.toContain("Secret text");
    expect(await deleteComment(id)).toEqual(COMMENT_NOT_FOUND);
    signInAs(erin);
    expect(await replyToComment(id, "More")).toEqual(COMMENT_NOT_FOUND);

    // The last reply takes the placeholder with it.
    expect(await deleteComment(replyId)).toEqual({ ok: true });
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("keeps the placeholder of an account without a public name", async () => {
    const id = await comment(dave, "Text");
    await reply(erin, id, "Reply");
    signInAs(dave);
    await deleteComment(id);
    await User.updateOne({ _id: dave }, { $unset: { nickname: 1 } });
    const [shown] = (await chapterThread(null)).comments;
    expect(shown).toMatchObject({ id, state: "deleted", author: null });
    expect(shown.replies).toHaveLength(1);
  });

  it("refuses a reply when its thread went meanwhile", async () => {
    const id = await comment(dave, "Text");
    const first = await reply(erin, id, "Reply");
    signInAs(dave);
    await deleteComment(id);
    // The last reply goes after the new reply has read its thread.
    const original = Comment.create.bind(Comment);
    const spy = vi.spyOn(Comment, "create").mockImplementationOnce((async (
      doc: unknown,
    ) => {
      await Comment.deleteMany({});
      return original(doc as never);
    }) as never);
    signInAs(alice);
    expect(await replyToComment(first, "Late")).toEqual(COMMENT_NOT_FOUND);
    spy.mockRestore();
    expect(await Comment.countDocuments()).toBe(0);
    expect(await Activity.countDocuments()).toBe(0);
  });

  it("deleting a comment without replies removes it", async () => {
    const id = await comment(dave, "Gone");
    expect(await deleteComment(id)).toEqual({ ok: true });
    expect(await Comment.countDocuments()).toBe(0);
    expect((await chapterThread(null)).comments).toEqual([]);
  });
});

describe("visibility of the chapter or book (criterion 3)", () => {
  it("a hidden chapter refuses writes; publishing again brings comments back", async () => {
    const id = await comment(dave, "Before");
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Now")).toEqual(TARGET_NOT_FOUND);
    expect(await editComment(id, "Edit")).toEqual(TARGET_NOT_FOUND);
    signInAs(erin);
    expect(await replyToComment(id, "Reply")).toEqual(TARGET_NOT_FOUND);
    expect(await countBookComments(null, book.folderId, [])).toEqual(new Map());

    await Story.updateOne({ _id: book.storyId }, { publication: "public" });
    expect((await chapterThread(null)).comments).toHaveLength(1);
    expect(await replyToComment(id, "Reply")).toMatchObject({ ok: true });
  });

  it("an unpublished or deleted book refuses writes in both threads", async () => {
    const id = await comment(dave, "Before", bookPlace());
    for (const change of [{ published: false }, { deletedAt: new Date() }]) {
      await Folder.updateOne({ _id: book.folderId }, change);
      signInAs(dave);
      expect(await addComment(bookPlace(), "Now")).toEqual(TARGET_NOT_FOUND);
      expect(await addComment(chapterPlace(), "Now")).toEqual(TARGET_NOT_FOUND);
      signInAs(erin);
      expect(await replyToComment(id, "Reply")).toEqual(TARGET_NOT_FOUND);
      await Folder.updateOne(
        { _id: book.folderId },
        { published: true, deletedAt: null },
      );
    }
    expect(await Comment.countDocuments()).toBe(1);
  });

  it("a deleted chapter refuses writes; a book without public chapters too", async () => {
    await Story.updateOne({ _id: book.storyId }, { deletedAt: new Date() });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(TARGET_NOT_FOUND);
    expect(await addComment(bookPlace(), "Hi")).toEqual(TARGET_NOT_FOUND);
  });

  it("hard deletion of a chapter or a folder deletes their comments", async () => {
    await reply(alice, await comment(dave, "Chapter"), "Reply");
    await comment(dave, "Book", bookPlace());
    expect(await Activity.countDocuments({ type: "authorReply" })).toBe(1);
    await purgeSocialData({ folderIds: [], storyIds: [book.storyId] });
    expect(await Comment.countDocuments()).toBe(1);
    expect(await Activity.countDocuments({ type: "authorReply" })).toBe(0);
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await Comment.countDocuments()).toBe(0);
  });
});

describe("moving a chapter to another book", () => {
  it("takes its comments, marks and author replies along, so purging the old book keeps them", async () => {
    const id = await comment(dave, "Chapter");
    await reply(alice, id, "Answer");
    await comment(dave, "Book", bookPlace());
    await ReaderMark.create({
      userId: dave,
      storyId: book.storyId,
      folderId: book.folderId,
      kind: "bookmark",
      position: 0.5,
    });
    const other = await Folder.create({
      userId: alice,
      name: "Other",
      published: true,
    });
    signInAs(alice);
    expect(await moveStory(book.storyId, other._id.toString())).toEqual({
      ok: true,
    });
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await Comment.countDocuments({ storyId: book.storyId })).toBe(2);
    expect(await Comment.countDocuments({ storyId: null })).toBe(0);
    expect(await ReaderMark.countDocuments()).toBe(1);
    expect(
      await Activity.countDocuments({
        type: "authorReply",
        folderId: other._id,
      }),
    ).toBe(1);
    const counts = await countBookComments(null, other._id.toString(), [
      book.storyId,
    ]);
    expect(counts.get(book.storyId)).toBe(2);
  });
});

describe("comments turned off (criterion 4)", () => {
  it("a chapter's switch refuses new comments and hides existing ones", async () => {
    const id = await comment(dave, "Before");
    signInAs(alice);
    expect(await setStoryCommentsDisabled(book.storyId, true)).toEqual({
      ok: true,
    });
    expect(await chapterThread(null)).toEqual({
      disabled: true,
      authorId: alice.toString(),
      moderatedAuthorId: null,
      total: 0,
      comments: [],
      next: null,
    });
    expect(
      await countBookComments(null, book.folderId, [book.storyId]),
    ).toEqual(new Map());
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Now")).toEqual(DISABLED);
    expect(await editComment(id, "Edit")).toEqual(DISABLED);
    signInAs(erin);
    expect(await replyToComment(id, "Reply")).toEqual(DISABLED);
    // The book's own thread stays open.
    expect(await addComment(bookPlace(), "Book")).toMatchObject({ ok: true });

    signInAs(alice);
    await setStoryCommentsDisabled(book.storyId, false);
    expect((await chapterThread(null)).comments).toHaveLength(1);
  });

  it("a book's switch covers its thread and every chapter", async () => {
    await comment(dave, "Before", bookPlace());
    signInAs(alice);
    expect(await setFolderCommentsDisabled(book.folderId, true)).toEqual({
      ok: true,
    });
    expect((await bookThread(null)).disabled).toBe(true);
    expect((await chapterThread(null)).disabled).toBe(true);
    signInAs(dave);
    expect(await addComment(bookPlace(), "Now")).toEqual(DISABLED);
    expect(await addComment(chapterPlace(), "Now")).toEqual(DISABLED);
    signInAs(alice);
    await setFolderCommentsDisabled(book.folderId, false);
    expect((await bookThread(null)).comments).toHaveLength(1);
  });

  it("the switch keeps updatedAt and belongs to the author only", async () => {
    const before = await Story.findById(book.storyId).lean();
    signInAs(alice);
    await setStoryCommentsDisabled(book.storyId, true);
    await setFolderCommentsDisabled(book.folderId, true);
    const after = await Story.findById(book.storyId).lean();
    expect(after!.updatedAt).toEqual(before!.updatedAt);
    signInAs(dave);
    expect(await setStoryCommentsDisabled(book.storyId, false)).toEqual(
      error("NOT_FOUND", "storyNotFound"),
    );
    expect(await setFolderCommentsDisabled(book.folderId, false)).toEqual(
      error("NOT_FOUND", "folderNotFound"),
    );
  });
});

describe("bans and blocks refuse writes (criterion 5)", () => {
  it("a ban in the author's community", async () => {
    const id = await comment(erin, "Top");
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "Spam",
      by: alice,
    });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(REFUSED);
    expect(await addComment(bookPlace(), "Hi")).toEqual(REFUSED);
    expect(await replyToComment(id, "Hi")).toEqual(REFUSED);
  });

  it("an expired community ban no longer refuses", async () => {
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: new Date(Date.now() - 1000),
      reason: "Spam",
      by: alice,
    });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toMatchObject({ ok: true });
  });

  it("a global ban of the writer", async () => {
    const id = await comment(dave, "Mine");
    await User.updateOne(
      { _id: dave },
      { globalBan: { until: null, reason: "Spam", by: alice, at: new Date() } },
    );
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(REFUSED);
    expect(await replyToComment(id, "Hi")).toEqual(REFUSED);
    expect(await editComment(id, "Edit")).toEqual(REFUSED);
    // Deleting one's own stays possible.
    expect(await deleteComment(id)).toEqual({ ok: true });
  });

  it("a global ban of the text's author hides the text", async () => {
    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "Spam", by: dave, at: new Date() } },
    );
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(TARGET_NOT_FOUND);
  });

  it("a block by the text's author", async () => {
    await Block.create({ blockerId: alice, blockedId: dave });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(REFUSED);
    expect(await addComment(bookPlace(), "Hi")).toEqual(REFUSED);
  });

  it("a block of the text's author by the writer hides the text", async () => {
    await Block.create({ blockerId: dave, blockedId: alice });
    signInAs(dave);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(TARGET_NOT_FOUND);
  });

  it("a block by the author of the comment replied to", async () => {
    const id = await comment(erin, "Top");
    await Block.create({ blockerId: erin, blockedId: dave });
    signInAs(dave);
    expect(await replyToComment(id, "Hi")).toEqual(REFUSED);
    expect(await addComment(chapterPlace(), "Hi")).toMatchObject({ ok: true });
  });

  it("a block of the comment's author by the writer", async () => {
    const id = await comment(erin, "Top");
    await Block.create({ blockerId: dave, blockedId: erin });
    signInAs(dave);
    expect(await replyToComment(id, "Hi")).toEqual(REFUSED);
  });

  it("a block by the author of the thread when replying to a reply", async () => {
    const id = await comment(erin, "Top");
    const replyId = await reply(alice, id, "Author");
    await Block.create({ blockerId: erin, blockedId: dave });
    signInAs(dave);
    expect(await replyToComment(replyId, "Hi")).toEqual(REFUSED);
  });

  it("an account without a nickname cannot sign a comment", async () => {
    const { insertedId } = await User.collection.insertOne({
      passwordHash: "x",
      createdAt: new Date(Date.now() - 2 * DAY),
    });
    signInAs(insertedId);
    expect(await addComment(chapterPlace(), "Hi")).toEqual(REFUSED);
  });
});

describe("what a viewer sees (criterion 6)", () => {
  it("leaves out comments of accounts the viewer blocked, with their replies", async () => {
    const erinsId = await comment(erin, "Erin's");
    await reply(dave, erinsId, "Dave under Erin");
    await comment(alice, "Alice's");
    const daveReply = await reply(dave, await comment(alice, "Second"), "Dave");
    await reply(erin, daveReply, "Erin under Alice");
    await Block.create({ blockerId: dave, blockedId: erin });

    const seen = await chapterThread(dave);
    expect(seen.comments.map(({ body }) => body)).toEqual([
      "Second",
      "Alice's",
    ]);
    expect(seen.comments[0].replies.map(({ body }) => body)).toEqual(["Dave"]);
    expect(seen.total).toBe(3);
    expect((await chapterThread(null)).total).toBe(6);
    expect((await chapterThread(alice)).total).toBe(6);
  });

  it("leaves out comments of globally banned accounts for everyone but them", async () => {
    await comment(erin, "Erin's");
    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "Spam", by: alice, at: new Date() } },
    );
    expect((await chapterThread(null)).comments).toEqual([]);
    expect((await chapterThread(dave)).comments).toEqual([]);
    expect((await chapterThread(erin)).comments).toHaveLength(1);
    expect(
      await countBookComments(null, book.folderId, [book.storyId]),
    ).toEqual(new Map());
  });

  it("shows a comment hidden by a moderator as a placeholder (task 79)", async () => {
    const id = await comment(dave, "Rude");
    await reply(erin, id, "Reply");
    await Comment.updateOne(
      { _id: id },
      { hidden: { by: alice, at: new Date() } },
    );
    const [shown] = (await chapterThread(null)).comments;
    expect(shown).toMatchObject({ state: "hidden", body: null, author: null });
    expect(shown.replies).toHaveLength(1);
    signInAs(erin);
    expect(await replyToComment(id, "More")).toEqual(COMMENT_NOT_FOUND);
  });
});

describe("limits (criterion 7)", () => {
  it("refuses a body over MAX_COMMENT_LENGTH or empty", async () => {
    signInAs(dave);
    expect(
      await addComment(chapterPlace(), "x".repeat(MAX_COMMENT_LENGTH + 1)),
    ).toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: en.errors.commentTooLong.replace(
        "{max, number}",
        MAX_COMMENT_LENGTH.toLocaleString("en"),
      ),
    });
    expect(await addComment(chapterPlace(), "   ")).toEqual(
      error("INVALID_INPUT", "commentRequired"),
    );
    expect(
      await addComment(chapterPlace(), "x".repeat(MAX_COMMENT_LENGTH)),
    ).toMatchObject({ ok: true });
  });

  it("allows 10 comments a minute and gives the day's attempt back", async () => {
    signInAs(dave);
    for (let i = 0; i < 10; i++) {
      expect(await addComment(chapterPlace(), `c${i}`)).toMatchObject({
        ok: true,
      });
    }
    expect(await addComment(chapterPlace(), "c10")).toEqual(RATE_LIMITED);
    const id = (await Comment.findOne().lean())!._id.toString();
    expect(await replyToComment(id, "r")).toEqual(RATE_LIMITED);
    expect(await editComment(id, "e")).toEqual(RATE_LIMITED);
    const day = await RateLimit.findOne({ _id: /^comment-day:/ }).lean();
    expect(day!.count).toBe(10);
  });

  it("gives an account younger than 24 hours half of the limit", async () => {
    const frank = await createUser("Frank", 60 * 1000);
    signInAs(frank);
    for (let i = 0; i < 5; i++) {
      expect(await addComment(chapterPlace(), `c${i}`)).toMatchObject({
        ok: true,
      });
    }
    expect(await addComment(chapterPlace(), "c5")).toEqual(RATE_LIMITED);
  });
});

describe("feed (task 75)", () => {
  beforeEach(async () => {
    await Follow.create({ followerId: dave, followeeId: alice });
  });

  it("records the author's reply and shows it to followers", async () => {
    const id = await comment(erin, "Question");
    await reply(dave, id, "Not the author");
    const replyId = await reply(alice, id, "Answer");
    const bookReply = await reply(
      alice,
      await comment(erin, "On the book", bookPlace()),
      "Book answer",
    );
    expect(await Activity.countDocuments({ type: "authorReply" })).toBe(2);

    const { entries } = await getFeed(dave.toString(), null);
    expect(entries).toEqual([
      expect.objectContaining({
        type: "authorReply",
        nickname: "Alice",
        chapter: null,
        commentPath: `/p/Alice/book#comment-${bookReply}`,
      }),
      expect.objectContaining({
        type: "authorReply",
        chapter: { title: "One", path: "/p/Alice/book/one" },
        commentPath: `/p/Alice/book/one#comment-${replyId}`,
      }),
    ]);

    signInAs(alice);
    await setStoryCommentsDisabled(book.storyId, true);
    expect((await getFeed(dave.toString(), null)).entries).toHaveLength(1);
    await setStoryCommentsDisabled(book.storyId, false);
    await deleteComment(replyId);
    expect(await Activity.countDocuments({ type: "authorReply" })).toBe(1);
    await Block.create({ blockerId: dave, blockedId: erin });
    expect((await getFeed(dave.toString(), null)).entries).toEqual([]);
    await Block.deleteMany({});
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    await deleteComment(bookReply);
    expect((await getFeed(dave.toString(), null)).entries).toEqual([]);
  });
});
