import { Types } from "mongoose";
import { profilePath } from "@/components/user-link";
import { connectDB } from "@/lib/db";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumThread } from "@/lib/models/forum-thread";
import { Notification } from "@/lib/models/notification";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { findChapterPaths, findPublicBooks } from "@/lib/publish/queries";
import { commentAnchor } from "@/lib/social/comments";
import { postAnchor, threadPath } from "@/lib/social/forums";
import {
  type NotificationType,
  NOTIFICATIONS_SHOWN,
} from "@/lib/social/notifications";
import { hiddenUserIdsFor } from "@/lib/social/permissions";

// The admins' queue (task 88).
const ADMIN_REPORTS_PATH = "/admin?tab=reports";

export interface NotificationView {
  id: string;
  type: NotificationType;
  count: number;
  read: boolean;
  updatedAt: string;
  // Nicknames of the latest actors the viewer may see; none for anonymous kinds.
  actors: string[];
  // The text's owner or the community, by nickname; null when hidden from the viewer.
  author: string | null;
  // In an author's community; a report without one is for the admins.
  community: boolean;
  // The chapter's or book's title while it is public.
  title: string | null;
  href: string | null;
  // About a comment rather than the text itself.
  onComment: boolean;
  // A mention in a direct message rather than in a comment (task 85).
  inMessage: boolean;
  // About a forum post (task 87); the title is the thread's.
  onPost: boolean;
  // About a whole thread rather than one of its posts.
  onThread: boolean;
  // The author of a pending invitation (moderatorInvite), for Accept and Decline.
  inviteFrom: string | null;
}

// Ratings are anonymous (D80), reports keep the reporter from the community (task 80) and
// moderation steps name the community, not the moderator.
const ANONYMOUS: readonly NotificationType[] = [
  "rating",
  "ban",
  "hidden",
  "report",
  "reportResolved",
  "reportDismissed",
];

const MODERATION_PAGE: readonly NotificationType[] = [
  "moderatorAccepted",
  "moderatorDeclined",
  "moderatorResigned",
];

export async function countUnread(userId: string): Promise<number> {
  await connectDB();
  return Notification.countDocuments({ userId, readAt: null });
}

const unique = (ids: Types.ObjectId[]) => [
  ...new Map(ids.map((id) => [id.toString(), id])).values(),
];

// The address and the title come from the ids when read (D80): a text deleted, made private or
// moved since is shown without a link and without its title.
export async function listNotifications(
  userId: string,
): Promise<NotificationView[]> {
  await connectDB();
  const raw = await Notification.find({ userId })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(NOTIFICATIONS_SHOWN)
    .lean();
  if (raw.length === 0) return [];
  const hidden = await hiddenUserIdsFor(userId);
  const isHidden = (id: Types.ObjectId) => hidden.some((h) => h.equals(id));
  const people = unique(
    raw.flatMap(({ actorIds, authorId }) => [
      ...actorIds,
      ...(authorId ? [authorId] : []),
    ]),
  );
  const folderIds = unique(raw.flatMap(({ folderId }) => folderId ?? []));
  const storyIds = unique(raw.flatMap(({ storyIds: ids }) => ids ?? []));
  const threadIds = unique(raw.flatMap(({ threadId }) => threadId ?? []));
  const threads =
    threadIds.length === 0
      ? []
      : await ForumThread.find({
          _id: { $in: threadIds },
          deletedAt: null,
          hidden: { $exists: false },
          userId: { $nin: hidden },
        })
          .select({ scope: 1, categoryId: 1, authorId: 1, title: 1 })
          .lean();
  const categories = new Set(
    threads.some(({ categoryId }) => categoryId)
      ? (
          await ForumCategory.find({
            _id: { $in: threads.flatMap(({ categoryId }) => categoryId ?? []) },
          })
            .select({ _id: 1 })
            .lean()
        ).map(({ _id }) => _id)
      : [],
  );
  people.push(...unique(threads.flatMap(({ authorId }) => authorId ?? [])));
  const inviters = raw
    .filter(({ type }) => type === "moderatorInvite")
    .flatMap(({ authorId }) => authorId ?? []);
  const [users, privateLibraries, books, stories, invitations] =
    await Promise.all([
      User.find({ _id: { $in: people }, nickname: { $type: "string" } })
        .select({ nickname: 1 })
        .lean(),
      Profile.find({ userId: { $in: people }, libraryPublic: false })
        .select({ userId: 1 })
        .lean(),
      findPublicBooks(folderIds, hidden),
      Story.find({
        _id: { $in: storyIds },
        publication: "public",
        deletedAt: null,
      })
        .select({ userId: 1, folderId: 1, title: 1 })
        .lean(),
      inviters.length > 0
        ? CommunityModerator.find({
            userId,
            state: "invited",
            authorId: { $in: inviters },
          })
            .select({ authorId: 1 })
            .lean()
        : [],
    ]);
  const nicknames = new Map(
    users.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  const libraryHidden = new Set(
    privateLibraries.map(({ userId: id }) => id.toString()),
  );
  const visibleStories = stories.filter(({ folderId }) =>
    books.has(folderId.toString()),
  );
  const chapterPaths = await findChapterPaths(
    visibleStories,
    new Map(
      visibleStories.map(({ userId: authorId, folderId }) => [
        authorId.toString(),
        books.get(folderId.toString())!.nickname,
      ]),
    ),
  );
  const storyById = new Map(visibleStories.map((s) => [s._id.toString(), s]));
  // A thread while its forum is there for the viewer: the category exists, the author is not
  // hidden and has a nickname. The author's public books are not checked here.
  const threadPaths = new Map(
    threads.flatMap((thread) => {
      const id = thread._id.toString();
      if (thread.scope === "global") {
        return thread.categoryId && categories.has(thread.categoryId)
          ? [
              [
                id,
                {
                  title: thread.title,
                  path: threadPath({ scope: "global" }, id),
                },
              ] as const,
            ]
          : [];
      }
      const nickname =
        thread.authorId && !isHidden(thread.authorId)
          ? nicknames.get(thread.authorId.toString())
          : undefined;
      return nickname
        ? [
            [
              id,
              {
                title: thread.title,
                path: threadPath({ scope: "author", nickname }, id),
              },
            ] as const,
          ]
        : [];
    }),
  );
  const pending = new Set(
    invitations.map(({ authorId }) => authorId.toString()),
  );

  return raw.map((entry) => {
    const author =
      entry.authorId && !isHidden(entry.authorId)
        ? (nicknames.get(entry.authorId.toString()) ?? null)
        : null;
    const anonymous =
      ANONYMOUS.includes(entry.type) ||
      (entry.type === "library" &&
        entry.actorIds.some((id) => libraryHidden.has(id.toString())));
    const actors = anonymous
      ? []
      : entry.actorIds
          .toReversed()
          .filter((id) => !isHidden(id))
          .flatMap((id) => nicknames.get(id.toString()) ?? []);
    const book = entry.folderId && books.get(entry.folderId.toString());
    const [first] = entry.storyIds ?? [];
    const chapter = first && storyById.get(first.toString());
    // A chapter that left its book is still found by its own id.
    const chapterPath = chapter
      ? chapterPaths.get(chapter._id.toString())
      : null;
    const publication = entry.group === "chapters";
    const many = (entry.storyIds?.length ?? 0) > 1;
    let page: string | null = null;
    let title: string | null = null;
    if (first && !many) {
      page = chapterPath ?? null;
      title = chapter ? chapter.title : null;
    } else if (book) {
      page = book.path;
      title = book.name;
    }
    // A publication is named by its book, a single chapter linked directly.
    if (publication) title = book ? book.name : null;
    let href: string | null = page;
    if (page && entry.commentId) {
      href = `${page}#${commentAnchor(entry.commentId.toString())}`;
    }
    if (entry.threadId) {
      const thread = threadPaths.get(entry.threadId.toString());
      title = thread?.title ?? null;
      href = thread
        ? entry.postId
          ? `${thread.path}#${postAnchor(entry.postId.toString())}`
          : thread.path
        : null;
    }
    if (entry.conversationId) {
      href = `/messages/${entry.conversationId.toString()}`;
    } else if (entry.type === "follower") {
      href = actors[0] ? profilePath(actors[0]) : null;
    } else if (entry.type === "ban") {
      href = author ? profilePath(author) : null;
    } else if (entry.type === "report") {
      href = entry.authorId ? "/moderation" : ADMIN_REPORTS_PATH;
    } else if (MODERATION_PAGE.includes(entry.type)) {
      href = "/moderation";
    } else if (
      entry.type === "moderatorInvite" ||
      entry.type === "moderatorRemoved" ||
      entry.type === "reportResolved" ||
      entry.type === "reportDismissed"
    ) {
      href = null;
    }
    return {
      id: entry._id.toString(),
      type: entry.type,
      count: entry.count,
      read: entry.readAt !== null,
      updatedAt: entry.updatedAt.toISOString(),
      actors,
      author,
      community: Boolean(entry.authorId),
      title,
      href,
      onComment: Boolean(entry.commentId),
      inMessage: Boolean(entry.conversationId),
      onPost: Boolean(entry.threadId),
      onThread: Boolean(entry.threadId) && !entry.postId,
      inviteFrom:
        entry.type === "moderatorInvite" &&
        entry.authorId &&
        pending.has(entry.authorId.toString())
          ? entry.authorId.toString()
          : null,
    };
  });
}
