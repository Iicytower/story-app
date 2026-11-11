import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFolderCommentsDisabled } from "@/app/[locale]/(protected)/folders/actions";
import { moveStory } from "@/app/[locale]/(protected)/stories/actions";
import {
  addComment,
  deleteComment,
  replyToComment,
} from "@/app/[locale]/p/[nickname]/[folder]/comment-actions";
import { react } from "@/app/[locale]/p/[nickname]/[folder]/reaction-actions";
import { requireUser } from "@/lib/auth/session";
import { Block } from "@/lib/models/block";
import { Comment } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { Folder } from "@/lib/models/folder";
import { Reaction } from "@/lib/models/reaction";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS } from "@/lib/rate-limit";
import { purgeSocialData } from "@/lib/social/cascade";
import {
  getChapterReactions,
  getReactionSummaries,
} from "@/lib/social/reaction-summary";
import { REACTORS_SHOWN } from "@/lib/social/reactions";
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
const NOT_FOUND = error("NOT_FOUND", "reactionTargetNotFound");
const REFUSED = error("FORBIDDEN", "interactionNotAllowed");
const INVALID = error("INVALID_INPUT", "requestInvalid");

let alice: Types.ObjectId;
let dave: Types.ObjectId;
let erin: Types.ObjectId;
let book: { folderId: string; storyId: string };

async function createUser(nickname: string | null, age = 2 * DAY) {
  const { insertedId } = await User.collection.insertOne({
    ...(nickname && { nickname }),
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

async function comment(
  as: Types.ObjectId,
  place: { storyId: string } | { folderId: string } = { storyId: book.storyId },
) {
  signInAs(as);
  const result = await addComment(place, "A comment");
  if (!result.ok) throw new Error(result.message);
  return result.id;
}

const reactToChapter = (as: Types.ObjectId, reaction: "heart" | null) => {
  signInAs(as);
  return react("story", book.storyId, reaction);
};

const chapter = async (viewer: Types.ObjectId | null) =>
  (await getChapterReactions(viewer?.toString() ?? null, book.storyId)).summary;

beforeEach(async () => {
  alice = await createUser("Alice");
  dave = await createUser("Dave");
  erin = await createUser("Erin");
  book = await seedBook();
});

describe("one reaction per object (criterion 1)", () => {
  it("adds, replaces with another and takes off with the same one", async () => {
    signInAs(dave);
    expect(await react("story", book.storyId, "heart")).toEqual({
      ok: true,
      reaction: "heart",
    });
    expect(await Reaction.findOne().lean()).toMatchObject({
      userId: dave,
      targetType: "story",
      targetId: new Types.ObjectId(book.storyId),
      authorId: alice,
      folderId: new Types.ObjectId(book.folderId),
      storyId: new Types.ObjectId(book.storyId),
      reaction: "heart",
    });
    expect(await react("story", book.storyId, "fire")).toEqual({
      ok: true,
      reaction: "fire",
    });
    expect(await Reaction.countDocuments()).toBe(1);
    const set = await Reaction.findOne().lean();
    expect(set).toMatchObject({ reaction: "fire" });
    // The same one again changes nothing; the client sends null to take it off.
    expect(await react("story", book.storyId, "fire")).toEqual({
      ok: true,
      reaction: "fire",
    });
    expect(await Reaction.findOne().lean()).toEqual(set);
    expect(await react("story", book.storyId, null)).toEqual({
      ok: true,
      reaction: null,
    });
    expect(await Reaction.countDocuments()).toBe(0);
  });

  it("a comment deleted while the reaction is saved keeps none", async () => {
    const id = await comment(erin);
    const save = Reaction.updateOne.bind(Reaction);
    const spy = vi.spyOn(Reaction, "updateOne").mockImplementationOnce(((
      ...args: Parameters<typeof save>
    ) => {
      const saved = save(...args);
      return saved.then(async (result) => {
        await Comment.deleteOne({ _id: id });
        return result;
      });
    }) as never);
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
    spy.mockRestore();
    expect(await Reaction.countDocuments()).toBe(0);
  });

  it("null takes the reaction off and is fine without one", async () => {
    expect(await reactToChapter(dave, null)).toEqual({
      ok: true,
      reaction: null,
    });
    await reactToChapter(dave, "heart");
    expect(await reactToChapter(dave, null)).toEqual({
      ok: true,
      reaction: null,
    });
    expect(await Reaction.countDocuments()).toBe(0);
  });

  it("parallel requests leave a single document", async () => {
    signInAs(dave);
    const results = await Promise.all(
      (["heart", "laugh", "wow", "sad", "fire", "clap"] as const).map(
        (reaction) => react("story", book.storyId, reaction),
      ),
    );
    for (const result of results) expect(result).toMatchObject({ ok: true });
    expect(await Reaction.countDocuments()).toBe(1);
  });

  it("reacts to a comment and a reply under the chapter and the book", async () => {
    const top = await comment(dave);
    signInAs(alice);
    const answer = await replyToComment(top, "Thanks");
    if (!answer.ok) throw new Error(answer.message);
    const onBook = await comment(dave, { folderId: book.folderId });
    signInAs(erin);
    expect(await react("comment", top, "clap")).toMatchObject({ ok: true });
    expect(await react("comment", answer.id, "heart")).toMatchObject({
      ok: true,
    });
    expect(await react("comment", onBook, "wow")).toMatchObject({ ok: true });
    expect(await Reaction.findOne({ targetId: onBook }).lean()).toMatchObject({
      authorId: alice,
      folderId: new Types.ObjectId(book.folderId),
      storyId: null,
    });
    // The text's author reacts to comments under it.
    signInAs(alice);
    expect(await react("comment", top, "heart")).toMatchObject({ ok: true });
  });

  it("rejects bad input and a signed-out caller", async () => {
    signInAs(dave);
    expect(await react("story", book.storyId, "like" as never)).toEqual(
      INVALID,
    );
    expect(await react("story", "nope", "heart")).toEqual(INVALID);
    expect(await react("folder" as never, book.folderId, "heart")).toEqual(
      INVALID,
    );
    // A post's id that is no post (task 87).
    expect(await react("post", book.storyId, "heart")).toEqual(NOT_FOUND);
    expect(
      await react("story", new Types.ObjectId().toString(), "heart"),
    ).toEqual(NOT_FOUND);
    signInAs(null);
    expect(await react("story", book.storyId, "heart")).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await Reaction.countDocuments()).toBe(0);
  });

  it("an account without a nickname does not react", async () => {
    const anonymous = await createUser(null);
    expect(await reactToChapter(anonymous, "heart")).toEqual(REFUSED);
  });

  it("is limited per account, half for a new account", async () => {
    const young = await createUser("Young", 1000);
    signInAs(young);
    for (let i = 0; i < SOCIAL_LIMITS.react.max / 2; i++) {
      expect(await react("story", book.storyId, "heart")).toMatchObject({
        ok: true,
      });
    }
    expect(await react("story", book.storyId, "heart")).toEqual(
      error("RATE_LIMITED", "tooManyAttempts"),
    );
  });
});

describe("counts and the list of nicknames (criterion 2)", () => {
  it("match the database; a guest sees them, the reader their own", async () => {
    await reactToChapter(dave, "heart");
    signInAs(erin);
    await react("story", book.storyId, "heart");
    const guest = await chapter(null);
    expect(guest).toEqual({
      mine: null,
      groups: [{ reaction: "heart", count: 2, nicknames: ["Erin", "Dave"] }],
    });
    expect(JSON.stringify(guest)).not.toContain(dave.toString());
    signInAs(erin);
    await react("story", book.storyId, "laugh");
    expect(await chapter(erin)).toEqual({
      mine: "laugh",
      groups: [
        { reaction: "heart", count: 1, nicknames: ["Dave"] },
        { reaction: "laugh", count: 1, nicknames: ["Erin"] },
      ],
    });
  });

  it("shows the newest nicknames and counts the rest", async () => {
    const users = await User.insertMany(
      Array.from({ length: REACTORS_SHOWN + 2 }, (_, i) => ({
        nickname: `Reader${i}`,
        passwordHash: "x",
      })),
    );
    await Reaction.insertMany(
      users.map(({ _id }, i) => ({
        userId: _id,
        targetType: "story",
        targetId: book.storyId,
        authorId: alice,
        folderId: book.folderId,
        storyId: book.storyId,
        reaction: "fire",
        createdAt: new Date(Date.now() - (users.length - i) * 1000),
      })),
    );
    const [group] = (await chapter(null)).groups;
    expect(group.count).toBe(REACTORS_SHOWN + 2);
    expect(group.nicknames).toHaveLength(REACTORS_SHOWN);
    expect(group.nicknames[0]).toBe(`Reader${REACTORS_SHOWN + 1}`);
  });

  it("leaves out accounts blocked by the viewer and globally banned ones", async () => {
    await reactToChapter(dave, "heart");
    signInAs(erin);
    await react("story", book.storyId, "heart");
    await Block.create({ blockerId: alice, blockedId: dave });
    expect((await chapter(alice)).groups).toEqual([
      { reaction: "heart", count: 1, nicknames: ["Erin"] },
    ]);
    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "Spam", by: alice, at: new Date() } },
    );
    expect((await chapter(null)).groups).toEqual([
      { reaction: "heart", count: 1, nicknames: ["Dave"] },
    ]);
    // The banned account still sees its own reaction.
    expect((await chapter(erin)).mine).toBe("heart");
  });

  it("are kept apart per comment", async () => {
    const one = await comment(dave);
    const two = await comment(dave);
    signInAs(erin);
    await react("comment", one, "sad");
    const summaries = await getReactionSummaries(null, "comment", [one, two]);
    expect(summaries.get(one)?.groups).toEqual([
      { reaction: "sad", count: 1, nicknames: ["Erin"] },
    ]);
    expect(summaries.get(two)).toEqual({ groups: [], mine: null });
  });
});

describe("bans and blocks refuse a reaction (criterion 3)", () => {
  it("the author does not react to their own chapter or comment", async () => {
    expect(await reactToChapter(alice, "heart")).toEqual(REFUSED);
    const id = await comment(dave);
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(REFUSED);
    expect(
      (await getChapterReactions(alice.toString(), book.storyId)).own,
    ).toBe(true);
    expect((await getChapterReactions(dave.toString(), book.storyId)).own).toBe(
      false,
    );
  });

  it("a ban in the author's community", async () => {
    const id = await comment(erin);
    await CommunityBan.create({
      authorId: alice,
      userId: dave,
      until: null,
      reason: "Spam",
      by: alice,
    });
    signInAs(dave);
    expect(await react("story", book.storyId, "heart")).toEqual(REFUSED);
    expect(await react("comment", id, "heart")).toEqual(REFUSED);
  });

  it("a global ban of the reader", async () => {
    const id = await comment(erin);
    await User.updateOne(
      { _id: dave },
      { globalBan: { until: null, reason: "Spam", by: alice, at: new Date() } },
    );
    signInAs(dave);
    expect(await react("story", book.storyId, "heart")).toEqual(REFUSED);
    expect(await react("comment", id, "heart")).toEqual(REFUSED);
  });

  it("a global ban of the text's author hides the text", async () => {
    await User.updateOne(
      { _id: alice },
      { globalBan: { until: null, reason: "Spam", by: dave, at: new Date() } },
    );
    expect(await reactToChapter(dave, "heart")).toEqual(NOT_FOUND);
  });

  it("a block by the text's author", async () => {
    const id = await comment(erin);
    await Block.create({ blockerId: alice, blockedId: dave });
    signInAs(dave);
    expect(await react("story", book.storyId, "heart")).toEqual(REFUSED);
    expect(await react("comment", id, "heart")).toEqual(REFUSED);
  });

  it("a block of the text's author by the reader hides the text", async () => {
    await Block.create({ blockerId: dave, blockedId: alice });
    expect(await reactToChapter(dave, "heart")).toEqual(NOT_FOUND);
  });

  it("a block by the comment's writer", async () => {
    const id = await comment(erin);
    await Block.create({ blockerId: erin, blockedId: dave });
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(REFUSED);
    expect(await react("story", book.storyId, "heart")).toMatchObject({
      ok: true,
    });
  });

  it("a block of the comment's writer by the reader hides the comment", async () => {
    const id = await comment(erin);
    await Block.create({ blockerId: dave, blockedId: erin });
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
  });

  it("a reply under a thread of an account hidden from the reader", async () => {
    const top = await comment(erin);
    signInAs(alice);
    const answer = await replyToComment(top, "Thanks");
    if (!answer.ok) throw new Error(answer.message);
    await Block.create({ blockerId: dave, blockedId: erin });
    signInAs(dave);
    expect(await react("comment", answer.id, "heart")).toEqual(NOT_FOUND);
  });

  it("a global ban of the comment's writer hides the comment", async () => {
    const id = await comment(erin);
    await User.updateOne(
      { _id: erin },
      { globalBan: { until: null, reason: "Spam", by: alice, at: new Date() } },
    );
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
  });
});

describe("visibility (criterion 4)", () => {
  it("a chapter that is no longer public takes no reactions; republished, they are back", async () => {
    await reactToChapter(dave, "heart");
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    expect(await reactToChapter(erin, "heart")).toEqual(NOT_FOUND);
    expect(await reactToChapter(dave, null)).toEqual(NOT_FOUND);
    expect(await Reaction.countDocuments()).toBe(1);
    await Story.updateOne({ _id: book.storyId }, { publication: "public" });
    expect((await chapter(null)).groups).toEqual([
      { reaction: "heart", count: 1, nicknames: ["Dave"] },
    ]);
  });

  it("an unpublished or deleted book and a deleted chapter", async () => {
    await Folder.updateOne({ _id: book.folderId }, { published: false });
    expect(await reactToChapter(dave, "heart")).toEqual(NOT_FOUND);
    await Folder.updateOne({ _id: book.folderId }, { published: true });
    await Story.updateOne({ _id: book.storyId }, { deletedAt: new Date() });
    expect(await reactToChapter(dave, "heart")).toEqual(NOT_FOUND);
  });

  it("comments of a non-public chapter, turned off, deleted or hidden", async () => {
    const id = await comment(erin);
    const other = await comment(erin);
    await Story.updateOne({ _id: book.storyId }, { publication: "hidden" });
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
    await Story.updateOne({ _id: book.storyId }, { publication: "public" });
    signInAs(alice);
    await setFolderCommentsDisabled(book.folderId, true);
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
    signInAs(alice);
    await setFolderCommentsDisabled(book.folderId, false);
    await Comment.updateOne(
      { _id: id },
      { hidden: { by: alice, at: new Date() } },
    );
    signInAs(dave);
    expect(await react("comment", id, "heart")).toEqual(NOT_FOUND);
    signInAs(erin);
    await deleteComment(other);
    signInAs(dave);
    expect(await react("comment", other, "heart")).toEqual(NOT_FOUND);
  });
});

describe("deletion", () => {
  it("deleting a comment, also into a placeholder, deletes its reactions", async () => {
    const top = await comment(erin);
    const lone = await comment(erin);
    signInAs(alice);
    await replyToComment(top, "Reply");
    signInAs(dave);
    await react("comment", top, "heart");
    await react("comment", lone, "heart");
    await react("story", book.storyId, "heart");
    signInAs(erin);
    await deleteComment(top);
    await deleteComment(lone);
    expect(await Reaction.find().select({ targetType: 1 }).lean()).toEqual([
      expect.objectContaining({ targetType: "story" }),
    ]);
  });

  it("purging a chapter or a book deletes its reactions and its comments' ones", async () => {
    const onChapter = await comment(erin);
    const onBook = await comment(erin, { folderId: book.folderId });
    signInAs(dave);
    await react("story", book.storyId, "heart");
    await react("comment", onChapter, "heart");
    await react("comment", onBook, "heart");
    await purgeSocialData({ folderIds: [], storyIds: [book.storyId] });
    expect(await Reaction.countDocuments()).toBe(1);
    await purgeSocialData({ folderIds: [book.folderId], storyIds: [] });
    expect(await Reaction.countDocuments()).toBe(0);
  });

  it("a moved chapter takes its reactions along", async () => {
    const id = await comment(erin);
    signInAs(dave);
    await react("story", book.storyId, "heart");
    await react("comment", id, "heart");
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
    expect(await Reaction.countDocuments({ folderId: other._id })).toBe(2);
  });
});
