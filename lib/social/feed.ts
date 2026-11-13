import { Types } from "mongoose";
import { isAdult } from "@/lib/adult/adult";
import type { CoverView } from "@/lib/covers/queries";
import { connectDB } from "@/lib/db";
import { Activity, type ActivityType } from "@/lib/models/activity";
import { Block } from "@/lib/models/block";
import { Comment } from "@/lib/models/comment";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { ForumThread } from "@/lib/models/forum-thread";
import { NOT_DELETED, User } from "@/lib/models/user";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { avatarPath } from "@/lib/profiles/queries";
import { findChapterPaths, findPublicBooks } from "@/lib/publish/queries";
import { commentAnchor } from "@/lib/social/comments";
import { hasPublicBook, threadPath } from "@/lib/social/forums";
import { hiddenUserIdsFor } from "@/lib/social/permissions";

export const FEED_PAGE_SIZE = 30;
// Entries hidden at read time are skipped, so a page may need more than one batch; past this
// many the page ends short and the next one starts after the last entry read.
const MAX_BATCHES = 5;
const BATCH_SIZE = 2 * FEED_PAGE_SIZE;

interface Cursor {
  createdAt: Date;
  id: Types.ObjectId;
}

const CURSOR = /^(\d{1,15})_([0-9a-f]{24})$/;

export function parseFeedCursor(value: unknown): Cursor | null {
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) return null;
  return {
    createdAt: new Date(Number(match[1])),
    id: new Types.ObjectId(match[2]),
  };
}

const formatCursor = (createdAt: Date, id: Types.ObjectId | string) =>
  `${createdAt.getTime()}_${id.toString()}`;

const FEED_TYPES: ActivityType[] = [
  "chapterPublished",
  "authorReply",
  "forumThread",
];

interface FeedEntryBase {
  id: string;
  createdAt: Date;
  nickname: string;
}

type Book = {
  name: string;
  path: string;
  adult: boolean;
  cover: CoverView | null;
};

type FeedEntryData = FeedEntryBase &
  (
    | {
        type: "forumThread";
        thread: { title: string; path: string };
      }
    | {
        type: "chapterPublished";
        book: Book;
        // Chapters of the publication that are still public; a single one is linked by title.
        chapters: { title: string; path: string }[];
      }
    | {
        type: "authorReply";
        book: Book;
        // null for the thread under the book's contents.
        chapter: { title: string; path: string } | null;
        commentPath: string;
      }
  );

export type FeedEntry = FeedEntryData & { avatar: string | null };

interface RawEntry {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  type: ActivityType;
  folderId?: Types.ObjectId;
  storyIds?: Types.ObjectId[];
  commentId?: Types.ObjectId;
  threadId?: Types.ObjectId;
  createdAt: Date;
}

// Authors the feed leaves out: those hidden from the viewer (D80) and, in the feed only, those
// who blocked the viewer, so a block works both ways.
export async function feedHiddenUserIds(viewerId: string) {
  const [hidden, blockers] = await Promise.all([
    hiddenUserIdsFor(viewerId),
    Block.find({ blockedId: viewerId }, { _id: 0, blockerId: 1 }).lean(),
  ]);
  return [...hidden, ...blockers.map(({ blockerId }) => blockerId)];
}

// An author's reply shows while it is there, not hidden and its comments are on (task 76), and
// not in a thread of an account hidden from the viewer.
async function shownReplies(raw: RawEntry[], hidden: Types.ObjectId[]) {
  const replies = raw.filter(({ type }) => type === "authorReply");
  if (replies.length === 0) return new Set<string>();
  const [comments, closed] = await Promise.all([
    Comment.find({
      _id: { $in: replies.flatMap(({ commentId }) => commentId ?? []) },
      deletedAt: null,
      hidden: { $exists: false },
    })
      .select({ userId: 1, parentId: 1 })
      .lean(),
    Folder.find({
      _id: { $in: replies.flatMap(({ folderId }) => folderId ?? []) },
      commentsDisabled: true,
    })
      .select({ _id: 1 })
      .lean(),
  ]);
  const roots = await Comment.find({
    _id: { $in: comments.flatMap(({ parentId }) => parentId ?? []) },
    userId: { $nin: hidden },
  })
    .select({ _id: 1 })
    .lean();
  const rootIds = new Set(roots.map(({ _id }) => _id.toString()));
  const closedIds = new Set(closed.map(({ _id }) => _id.toString()));
  const byId = new Map(comments.map((c) => [c._id.toString(), c]));
  return new Set(
    replies
      .filter(({ commentId, actorId, folderId }) => {
        const comment = commentId && byId.get(commentId.toString());
        return (
          comment &&
          comment.userId.equals(actorId) &&
          comment.parentId &&
          rootIds.has(comment.parentId.toString()) &&
          !closedIds.has(folderId!.toString())
        );
      })
      .map(({ _id }) => _id.toString()),
  );
}

// A new thread of the author in their own forum (task 87), while it is there, not hidden and the
// forum exists (a public book).
async function shownThreads(raw: RawEntry[]) {
  const entries = raw.filter(({ type }) => type === "forumThread");
  if (entries.length === 0) return new Map<string, FeedEntryData>();
  const threads = await ForumThread.find({
    _id: { $in: entries.flatMap(({ threadId }) => threadId ?? []) },
    scope: "author",
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ userId: 1, authorId: 1, title: 1 })
    .lean();
  const authorIds = [
    ...new Set(
      threads
        .filter(({ userId, authorId }) => authorId?.equals(userId))
        .map(({ userId }) => userId.toString()),
    ),
  ];
  const [users, forums] = await Promise.all([
    User.find({
      _id: { $in: authorIds },
      nickname: { $type: "string" },
      ...NOT_DELETED,
    })
      .select({ nickname: 1 })
      .lean(),
    Promise.all(
      authorIds.map(async (id) => [id, await hasPublicBook(id)] as const),
    ),
  ]);
  const open = new Set(forums.flatMap(([id, has]) => (has ? [id] : [])));
  const nicknames = new Map(
    users.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  const byId = new Map(
    threads.map((thread) => [thread._id.toString(), thread]),
  );
  const shown = new Map<string, FeedEntryData>();
  for (const entry of entries) {
    const thread = entry.threadId && byId.get(entry.threadId.toString());
    const actor = entry.actorId.toString();
    const nickname = nicknames.get(actor);
    if (!thread || !thread.userId.equals(entry.actorId) || !nickname) continue;
    if (!open.has(actor)) continue;
    shown.set(entry._id.toString(), {
      id: entry._id.toString(),
      createdAt: entry.createdAt,
      nickname,
      type: "forumThread",
      thread: {
        title: thread.title,
        path: threadPath({ scope: "author", nickname }, thread._id.toString()),
      },
    });
  }
  return shown;
}

// D38 at read time: a published active book with chapters of this publication still public in it.
async function visibleEntries(
  raw: RawEntry[],
  hidden: Types.ObjectId[],
): Promise<Map<string, FeedEntryData>> {
  const folderIds = [
    ...new Set(raw.flatMap(({ folderId }) => folderId?.toString() ?? [])),
  ];
  const books = await findPublicBooks(
    folderIds.map((id) => new Types.ObjectId(id)),
    hidden,
  );
  const stories = await Story.find({
    _id: { $in: raw.flatMap(({ storyIds }) => storyIds ?? []) },
    folderId: { $in: [...books.keys()] },
    publication: "public",
    deletedAt: null,
  })
    .select({
      userId: 1,
      folderId: 1,
      title: 1,
      adult: 1,
      commentsDisabled: 1,
    })
    .lean();
  const [replies, threads] = await Promise.all([
    shownReplies(raw, hidden),
    shownThreads(raw),
  ]);
  const paths = await findChapterPaths(
    stories,
    new Map(
      stories.map(({ userId, folderId }) => [
        userId.toString(),
        books.get(folderId.toString())!.nickname,
      ]),
    ),
  );
  const storyById = new Map(
    stories.map((story) => [story._id.toString(), story]),
  );
  const entries = new Map<string, FeedEntryData>(threads);
  for (const entry of raw) {
    if (entry.type === "forumThread") continue;
    const book = entry.folderId && books.get(entry.folderId.toString());
    if (!book) continue;
    const chapters = (entry.storyIds ?? []).flatMap((id) => {
      const story = storyById.get(id.toString());
      return story &&
        story.folderId.equals(entry.folderId!) &&
        story.userId.equals(entry.actorId)
        ? [story]
        : [];
    });
    const base = {
      id: entry._id.toString(),
      createdAt: entry.createdAt,
      nickname: book.nickname,
      book: {
        name: book.name,
        path: book.path,
        adult: book.adult || chapters.some(({ adult }) => isAdult(adult)),
        cover: book.cover,
      },
    };
    if (entry.type === "authorReply") {
      const [chapter] = chapters;
      const onChapter = (entry.storyIds ?? []).length > 0;
      if (!replies.has(entry._id.toString())) continue;
      if (onChapter && (!chapter || chapter.commentsDisabled)) continue;
      const page = chapter ? paths.get(chapter._id.toString())! : book.path;
      entries.set(entry._id.toString(), {
        ...base,
        type: "authorReply",
        chapter: chapter ? { title: chapter.title, path: page } : null,
        commentPath: `${page}#${commentAnchor(entry.commentId!.toString())}`,
      });
      continue;
    }
    if (chapters.length === 0) continue;
    entries.set(entry._id.toString(), {
      ...base,
      type: "chapterPublished",
      chapters: chapters.map(({ _id, title }) => ({
        title,
        path: paths.get(_id.toString())!,
      })),
    });
  }
  return entries;
}

// Events of the authors the viewer follows, newest first, FEED_PAGE_SIZE per page. The cursor is
// (createdAt, _id), so entries with the same date are neither repeated nor skipped.
export async function getFeed(
  viewerId: string,
  after: Cursor | null,
): Promise<{ entries: FeedEntry[]; next: string | null }> {
  const page = await getFeedPage(viewerId, after);
  const users = await User.find({
    nickname: { $in: [...new Set(page.entries.map((e) => e.nickname))] },
  })
    .select({ nickname: 1 })
    .lean();
  const profiles = await Profile.find({
    userId: { $in: users.map(({ _id }) => _id) },
    avatarId: { $exists: true },
  })
    .select({ userId: 1, avatarId: 1 })
    .lean();
  const avatarOf = new Map(
    profiles.map(({ userId, avatarId }) => [
      userId.toString(),
      avatarPath(avatarId!.toString()),
    ]),
  );
  const byNickname = new Map(
    users.map(({ _id, nickname }) => [
      nickname,
      avatarOf.get(_id.toString()) ?? null,
    ]),
  );
  return {
    next: page.next,
    entries: page.entries.map((entry) => ({
      ...entry,
      avatar: byNickname.get(entry.nickname) ?? null,
    })),
  };
}

async function getFeedPage(
  viewerId: string,
  after: Cursor | null,
): Promise<{ entries: FeedEntryData[]; next: string | null }> {
  await connectDB();
  const [follows, hidden] = await Promise.all([
    Follow.find({ followerId: viewerId }, { _id: 0, followeeId: 1 }).lean(),
    feedHiddenUserIds(viewerId),
  ]);
  const hiddenIds = new Set(hidden.map(String));
  const actorIds = follows
    .map(({ followeeId }) => followeeId)
    .filter((id) => !hiddenIds.has(id.toString()));
  if (actorIds.length === 0) return { entries: [], next: null };

  const entries: FeedEntryData[] = [];
  let cursor = after;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const raw = await Activity.find({
      actorId: { $in: actorIds },
      type: { $in: FEED_TYPES },
      ...(cursor && {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      }),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(BATCH_SIZE)
      .select({
        actorId: 1,
        type: 1,
        folderId: 1,
        storyIds: 1,
        commentId: 1,
        threadId: 1,
        createdAt: 1,
      })
      .lean();
    const visible = await visibleEntries(raw, hidden);
    for (const entry of raw) {
      const shown = visible.get(entry._id.toString());
      if (!shown) continue;
      if (entries.length === FEED_PAGE_SIZE) {
        const last = entries.at(-1)!;
        return { entries, next: formatCursor(last.createdAt, last.id) };
      }
      entries.push(shown);
    }
    if (raw.length < BATCH_SIZE) return { entries, next: null };
    cursor = { createdAt: raw.at(-1)!.createdAt, id: raw.at(-1)!._id };
  }
  return {
    entries,
    next: cursor && formatCursor(cursor.createdAt, cursor.id),
  };
}
