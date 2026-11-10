import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Comment, type CommentFields } from "@/lib/models/comment";
import { Folder } from "@/lib/models/folder";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { avatarPath } from "@/lib/profiles/queries";
import { hiddenUserIdsFor } from "@/lib/social/permissions";

export const COMMENTS_PAGE_SIZE = 50;
export const MAX_REPLIES_SHOWN = 100;
export const COMMENT_EDIT_MS = 15 * 60 * 1000;
export const COMMENTS_PARAM = "comments";

export const commentAnchor = (id: string) => `comment-${id}`;

interface Cursor {
  createdAt: Date;
  id: Types.ObjectId;
}

const CURSOR = /^(\d{1,15})_([0-9a-f]{24})$/;

export function parseCommentsCursor(value: unknown): Cursor | null {
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) return null;
  return {
    createdAt: new Date(Number(match[1])),
    id: new Types.ObjectId(match[2]),
  };
}

export interface CommentTarget {
  folderId: string;
  // null is the thread under the book's contents.
  storyId: string | null;
}

// Only what the section shows: no user ids, and no text of deleted or hidden comments.
export interface CommentView {
  id: string;
  state: "visible" | "deleted" | "hidden";
  author: { nickname: string; avatar: string | null } | null;
  body: string | null;
  createdAt: string;
  edited: boolean;
  own: boolean;
  editableUntil: string | null;
}

export interface CommentThreadView extends CommentView {
  replies: CommentView[];
}

export interface CommentThread {
  disabled: boolean;
  total: number;
  comments: CommentThreadView[];
  next: string | null;
}

type Raw = Pick<
  CommentFields,
  "userId" | "body" | "createdAt" | "editedAt" | "deletedAt" | "hidden"
> & { _id: Types.ObjectId; parentId: Types.ObjectId | null };

const SELECT = {
  userId: 1,
  parentId: 1,
  body: 1,
  createdAt: 1,
  editedAt: 1,
  deletedAt: 1,
  hidden: 1,
} as const;

// Comments of accounts the viewer must not see go with their replies (D80); a moderator's hiding
// leaves a placeholder and the replies (task 79).
function visibleTo(hidden: Types.ObjectId[]) {
  return { userId: { $nin: hidden } };
}

// Counted like the list shows them: without hidden accounts' threads, deleted ones and those
// hidden by a moderator.
async function countShown(
  place: Record<string, unknown>,
  hidden: Types.ObjectId[],
) {
  const hiddenThreads =
    hidden.length === 0
      ? []
      : await (Comment.distinct("_id", {
          ...place,
          parentId: null,
          userId: { $in: hidden },
        }) as Promise<Types.ObjectId[]>);
  return {
    ...place,
    parentId: { $nin: hiddenThreads },
    deletedAt: null,
    hidden: { $exists: false },
    ...visibleTo(hidden),
  };
}

async function commentsAreOff({ folderId, storyId }: CommentTarget) {
  const [folder, story] = await Promise.all([
    Folder.findById(folderId).select({ commentsDisabled: 1 }).lean(),
    storyId
      ? Story.findById(storyId).select({ commentsDisabled: 1 }).lean()
      : null,
  ]);
  return Boolean(folder?.commentsDisabled || story?.commentsDisabled);
}

async function authorsOf(userIds: Types.ObjectId[]) {
  const ids = [...new Set(userIds.map(String))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, nickname: { $type: "string" } })
      .select({ nickname: 1 })
      .lean(),
    Profile.find({ userId: { $in: ids }, avatarId: { $exists: true } })
      .select({ userId: 1, avatarId: 1 })
      .lean(),
  ]);
  const avatars = new Map(
    profiles.map(({ userId, avatarId }) => [
      userId.toString(),
      avatarPath(avatarId!.toString()),
    ]),
  );
  return new Map(
    users.map(({ _id, nickname }) => [
      _id.toString(),
      { nickname: nickname!, avatar: avatars.get(_id.toString()) ?? null },
    ]),
  );
}

// The page of top-level comments, newest first, each with its replies oldest first.
export async function getCommentThread(
  viewerId: string | null,
  target: CommentTarget,
  after: Cursor | null,
): Promise<CommentThread> {
  await connectDB();
  if (await commentsAreOff(target)) {
    return { disabled: true, total: 0, comments: [], next: null };
  }
  const hidden = await hiddenUserIdsFor(viewerId);
  // A chapter's comments follow it by id, also into another book.
  const place = target.storyId
    ? { storyId: new Types.ObjectId(target.storyId) }
    : { folderId: new Types.ObjectId(target.folderId), storyId: null };
  const [top, total] = await Promise.all([
    Comment.find({
      ...place,
      parentId: null,
      ...visibleTo(hidden),
      ...(after && {
        $or: [
          { createdAt: { $lt: after.createdAt } },
          { createdAt: after.createdAt, _id: { $lt: after.id } },
        ],
      }),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(COMMENTS_PAGE_SIZE + 1)
      .select(SELECT)
      .lean<Raw[]>(),
    countShown(place, hidden).then((filter) => Comment.countDocuments(filter)),
  ]);
  const page = top.slice(0, COMMENTS_PAGE_SIZE);
  // Each comment's own first replies; one query per comment of the page uses { parentId, createdAt }.
  const replies = (
    await Promise.all(
      page.map(({ _id }) =>
        Comment.find({ parentId: _id, ...visibleTo(hidden) })
          .sort({ createdAt: 1, _id: 1 })
          .limit(MAX_REPLIES_SHOWN)
          .select(SELECT)
          .lean<Raw[]>(),
      ),
    )
  ).flat();
  const authors = await authorsOf(
    [...page, ...replies].map(({ userId }) => userId),
  );
  const now = Date.now();
  const view = (comment: Raw): CommentView | null => {
    const author = authors.get(comment.userId.toString());
    const state = comment.deletedAt
      ? "deleted"
      : comment.hidden
        ? "hidden"
        : "visible";
    // An account without a nickname or gone has no public name to sign a visible comment with.
    if (!author && state === "visible") return null;
    const own = viewerId !== null && comment.userId.equals(viewerId);
    const editableUntil = comment.createdAt.getTime() + COMMENT_EDIT_MS;
    return {
      id: comment._id.toString(),
      state,
      author: state === "visible" ? author! : null,
      body: state === "visible" ? comment.body : null,
      createdAt: comment.createdAt.toISOString(),
      edited: state === "visible" && comment.editedAt !== undefined,
      own: own && state === "visible",
      editableUntil:
        own && state === "visible" && editableUntil > now
          ? new Date(editableUntil).toISOString()
          : null,
    };
  };
  const byParent = Map.groupBy(replies, ({ parentId }) => parentId!.toString());
  const comments = page.flatMap((comment) => {
    const shown = view(comment);
    if (!shown) return [];
    return [
      {
        ...shown,
        replies: (byParent.get(comment._id.toString()) ?? []).flatMap(
          (reply) => view(reply) ?? [],
        ),
      },
    ];
  });
  const last = page.at(-1);
  return {
    disabled: false,
    total,
    comments,
    next:
      top.length > COMMENTS_PAGE_SIZE && last
        ? `${last.createdAt.getTime()}_${last._id.toString()}`
        : null,
  };
}

// Visible comments per public chapter of a book and under its contents (key null), for the
// contents page. Chapters by id, so a chapter moved from another book keeps its comments.
export async function countBookComments(
  viewerId: string | null,
  folderId: string,
  chapterIds: string[],
): Promise<Map<string | null, number>> {
  await connectDB();
  const folder = await Folder.findById(folderId)
    .select({ commentsDisabled: 1 })
    .lean();
  if (!folder || folder.commentsDisabled) return new Map();
  const [hidden, open] = await Promise.all([
    hiddenUserIdsFor(viewerId),
    Story.find({ _id: { $in: chapterIds }, commentsDisabled: { $ne: true } })
      .select({ _id: 1 })
      .lean(),
  ]);
  const match = await countShown(
    {
      $or: [
        { storyId: { $in: open.map(({ _id }) => _id) } },
        { folderId: folder._id, storyId: null },
      ],
    },
    hidden,
  );
  const counts = await Comment.aggregate<{
    _id: Types.ObjectId | null;
    count: number;
  }>([{ $match: match }, { $group: { _id: "$storyId", count: { $sum: 1 } } }]);
  return new Map(
    counts.map(({ _id, count }) => [_id?.toString() ?? null, count]),
  );
}
