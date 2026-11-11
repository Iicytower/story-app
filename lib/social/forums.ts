import { Types } from "mongoose";
import { profilePath } from "@/components/user-link";
import { findUserByNickname } from "@/lib/accounts";
import { connectDB } from "@/lib/db";
import { Block } from "@/lib/models/block";
import { Folder } from "@/lib/models/folder";
import {
  ForumCategory,
  type ForumCategoryFields,
} from "@/lib/models/forum-category";
import { ForumPost, type ForumPostFields } from "@/lib/models/forum-post";
import { ForumThread, type ForumThreadFields } from "@/lib/models/forum-thread";
import { Profile } from "@/lib/models/profile";
import { Story } from "@/lib/models/story";
import { ThreadFollow } from "@/lib/models/thread-follow";
import { User } from "@/lib/models/user";
import { avatarPath } from "@/lib/profiles/queries";
import { resolveMentions } from "@/lib/social/mentions";
import {
  canInteract,
  canModerate,
  hiddenUserIdsFor,
  isAdmin,
  isAuthorVisibleTo,
  isBanActive,
  moderationRole,
  moderatorIdsOf,
  type ModerationRole,
  type Permission,
} from "@/lib/social/permissions";

export const POST_EDIT_MS = 15 * 60 * 1000;
// No paging yet: the newest threads of a forum and the first posts of a thread.
export const THREADS_SHOWN = 100;
export const POSTS_SHOWN = 500;
// How much of a quoted post shows above the quoting one.
export const QUOTE_EXCERPT = 500;

export const postAnchor = (id: string) => `post-${id}`;
export const FORUMS_PATH = "/forums";
export const categoryPath = (key: string) => `${FORUMS_PATH}/${key}`;
export const authorForumPath = (nickname: string) =>
  `${profilePath(nickname)}/forum`;

export function threadPath(
  place: { scope: "global" } | { scope: "author"; nickname: string },
  threadId: string,
): string {
  return place.scope === "global"
    ? `${FORUMS_PATH}/t/${threadId}`
    : `${authorForumPath(place.nickname)}/${threadId}`;
}

export interface CategoryView {
  key: string;
  labels: { en: string; pl: string };
  adminOnly: boolean;
}

export type ForumPlace =
  | { scope: "global"; category: CategoryView; moderatorIds: string[] }
  | { scope: "author"; authorId: string; nickname: string };

const categoryView = (
  category: Pick<ForumCategoryFields, "_id" | "labels" | "adminOnly">,
): CategoryView => ({
  key: category._id,
  labels: category.labels,
  adminOnly: Boolean(category.adminOnly),
});

export async function listForumCategories(): Promise<CategoryView[]> {
  await connectDB();
  const categories = await ForumCategory.find()
    .sort({ order: 1, _id: 1 })
    .lean();
  return categories.map(categoryView);
}

export async function findCategoryPlace(
  key: string,
): Promise<Extract<ForumPlace, { scope: "global" }> | null> {
  await connectDB();
  const category = await ForumCategory.findById(key).lean();
  if (!category) return null;
  return {
    scope: "global",
    category: categoryView(category),
    moderatorIds: category.moderatorIds.map(String),
  };
}

// A forum exists for an account with a nickname and at least one public book (D38).
export async function hasPublicBook(
  userId: string | Types.ObjectId,
): Promise<boolean> {
  const folders = await Folder.find({
    userId,
    published: true,
    deletedAt: null,
  })
    .select({ _id: 1 })
    .lean();
  if (folders.length === 0) return false;
  const chapter = await Story.exists({
    userId,
    folderId: { $in: folders.map(({ _id }) => _id) },
    publication: "public",
    deletedAt: null,
  });
  return chapter !== null;
}

// The author's forum as the viewer sees it: not for a blocked or globally banned author (D80).
async function authorPlace(
  viewerId: string | null,
  user: { _id: Types.ObjectId; nickname?: string | null; globalBan?: unknown },
): Promise<Extract<ForumPlace, { scope: "author" }> | null> {
  if (!user.nickname) return null;
  const self = viewerId !== null && user._id.equals(viewerId);
  if (
    !self &&
    isBanActive(
      user.globalBan as { until: Date | null } | undefined,
      new Date(),
    )
  ) {
    return null;
  }
  const [visible, books] = await Promise.all([
    viewerId && !self ? isAuthorVisibleTo(viewerId, user._id) : true,
    hasPublicBook(user._id),
  ]);
  if (!visible || !books) return null;
  return {
    scope: "author",
    authorId: user._id.toString(),
    nickname: user.nickname,
  };
}

export async function findAuthorForum(
  viewerId: string | null,
  nickname: string,
) {
  await connectDB();
  const user = await findUserByNickname(nickname);
  return user ? authorPlace(viewerId, user) : null;
}

async function authorForumById(viewerId: string | null, authorId: string) {
  const user = await User.findById(authorId)
    .select({ nickname: 1, globalBan: 1 })
    .lean();
  return user ? authorPlace(viewerId, user) : null;
}

export type ForumRole = ModerationRole | "admin" | "categoryModerator";

// Who moderates the forum (D80): the author and their moderators, or the admins and the
// category's moderators. A global ban takes moderation away.
export async function forumRole(
  viewerId: string | null,
  place: ForumPlace,
): Promise<ForumRole | null> {
  if (!viewerId) return null;
  if (place.scope === "author") {
    return moderationRole(viewerId, place.authorId);
  }
  const viewer = await User.findById(viewerId)
    .select({ role: 1, globalBan: 1 })
    .lean();
  if (!viewer || isBanActive(viewer.globalBan, new Date())) return null;
  if (isAdmin(viewer)) return "admin";
  return place.moderatorIds.includes(viewerId) ? "categoryModerator" : null;
}

const CANNOT_MODERATE: Permission = {
  ok: false,
  error: "FORBIDDEN",
  key: "cannotModerate",
};

// Nobody moderates themselves; in a global category there is no community ban (the global one
// comes with task 88), and a category's moderator does not moderate an admin or a fellow
// moderator of the category.
export async function canModerateForum(
  actorId: string,
  place: ForumPlace,
  role: ForumRole,
  targetId: string,
  action: "hide" | "ban",
): Promise<Permission> {
  if (place.scope === "author") {
    return canModerate(actorId, {
      authorId: place.authorId,
      role: role as ModerationRole,
      targetId,
      action,
    });
  }
  if (actorId === targetId || action === "ban") return CANNOT_MODERATE;
  if (role === "categoryModerator") {
    if (place.moderatorIds.includes(targetId)) return CANNOT_MODERATE;
    const target = await User.findById(targetId).select({ role: 1 }).lean();
    if (isAdmin(target)) return CANNOT_MODERATE;
  }
  return { ok: true };
}

// Bans and blocks for writing or reacting in the forum (D80): the author's community ban and a
// block with the author; in a global category only the actor's own global ban (canInteract on
// oneself checks just that). Then a block with each account replied to or quoted.
export async function forumPermission(
  actorId: string,
  place: ForumPlace,
  kind: "forumPost" | "react",
  repliedTo: (string | Types.ObjectId)[],
): Promise<Permission> {
  const owner = place.scope === "author" ? place.authorId : actorId;
  const permission = await canInteract(actorId, { authorId: owner, kind });
  if (!permission.ok) return permission;
  const others = [...new Set(repliedTo.map(String))].filter(
    (id) => id !== actorId && id !== owner,
  );
  for (const authorId of others) {
    const reply = await canInteract(actorId, { authorId, kind: "reply" });
    if (!reply.ok) return reply;
  }
  return { ok: true };
}

type ThreadDoc = Pick<
  ForumThreadFields,
  | "scope"
  | "categoryId"
  | "authorId"
  | "userId"
  | "title"
  | "createdAt"
  | "lastPostAt"
  | "postCount"
  | "hidden"
> & { _id: Types.ObjectId };

const THREAD_SELECT = {
  scope: 1,
  categoryId: 1,
  authorId: 1,
  userId: 1,
  title: 1,
  createdAt: 1,
  lastPostAt: 1,
  postCount: 1,
  hidden: 1,
} as const;

export async function placeOfThread(
  viewerId: string | null,
  thread: Pick<ForumThreadFields, "scope" | "categoryId" | "authorId">,
): Promise<ForumPlace | null> {
  if (thread.scope === "global") {
    // A deleted category hides its threads (D80).
    return thread.categoryId ? findCategoryPlace(thread.categoryId) : null;
  }
  return thread.authorId
    ? authorForumById(viewerId, thread.authorId.toString())
    : null;
}

export interface VisibleThread {
  thread: ThreadDoc;
  place: ForumPlace;
  role: ForumRole | null;
  hidden: Types.ObjectId[];
}

// A thread the viewer sees (D80): its forum visible, not deleted, its starter not hidden from the
// viewer. A thread hidden by a moderator only for the forum's moderators.
export async function findVisibleThread(
  viewerId: string | null,
  threadId: string,
): Promise<VisibleThread | null> {
  if (!Types.ObjectId.isValid(threadId)) return null;
  await connectDB();
  const thread = await ForumThread.findOne({ _id: threadId, deletedAt: null })
    .select(THREAD_SELECT)
    .lean<ThreadDoc>();
  if (!thread) return null;
  const [place, hidden] = await Promise.all([
    placeOfThread(viewerId, thread),
    hiddenUserIdsFor(viewerId),
  ]);
  if (!place || hidden.some((id) => id.equals(thread.userId))) return null;
  const role = await forumRole(viewerId, place);
  if (thread.hidden && !role) return null;
  return { thread, place, role, hidden };
}

// A post the viewer sees as one: not deleted or hidden, in a visible thread that is not hidden,
// written by a named account not hidden from the viewer.
export async function findVisiblePost(viewerId: string, postId: string) {
  await connectDB();
  const post = await ForumPost.findOne({
    _id: postId,
    deletedAt: null,
    hidden: { $exists: false },
  })
    .select({ threadId: 1, userId: 1 })
    .lean();
  if (!post) return null;
  const [found, named] = await Promise.all([
    findVisibleThread(viewerId, post.threadId.toString()),
    User.exists({ _id: post.userId, nickname: { $type: "string" } }),
  ]);
  if (!found || found.thread.hidden || !named) return null;
  if (found.hidden.some((id) => id.equals(post.userId))) return null;
  return {
    _id: post._id,
    writerId: post.userId,
    threadId: post.threadId,
    threadUserId: found.thread.userId,
    place: found.place,
  };
}

export interface ThreadListItem {
  id: string;
  title: string;
  path: string;
  starter: string | null;
  postCount: number;
  lastPostAt: string;
  hidden: boolean;
}

// The newest threads by their last post; the forum's moderators also see hidden ones.
export async function listThreads(
  viewerId: string | null,
  place: ForumPlace,
): Promise<ThreadListItem[]> {
  await connectDB();
  const [hidden, role] = await Promise.all([
    hiddenUserIdsFor(viewerId),
    forumRole(viewerId, place),
  ]);
  const threads = await ForumThread.find({
    ...(place.scope === "global"
      ? { categoryId: place.category.key }
      : { authorId: new Types.ObjectId(place.authorId) }),
    scope: place.scope,
    deletedAt: null,
    userId: { $nin: hidden },
    ...(!role && { hidden: { $exists: false } }),
  })
    .sort({ lastPostAt: -1, _id: -1 })
    .limit(THREADS_SHOWN)
    .select(THREAD_SELECT)
    .lean<ThreadDoc[]>();
  const users = await User.find({
    _id: { $in: threads.map(({ userId }) => userId) },
    nickname: { $type: "string" },
  })
    .select({ nickname: 1 })
    .lean();
  const nicknames = new Map(
    users.map(({ _id, nickname }) => [_id.toString(), nickname]),
  );
  return threads.map((thread) => ({
    id: thread._id.toString(),
    title: thread.title,
    path: threadPath(place, thread._id.toString()),
    starter: nicknames.get(thread.userId.toString()) ?? null,
    postCount: thread.postCount,
    lastPostAt: thread.lastPostAt.toISOString(),
    hidden: Boolean(thread.hidden),
  }));
}

export interface PostView {
  id: string;
  state: "visible" | "deleted" | "hidden";
  author: { nickname: string; avatar: string | null } | null;
  body: string | null;
  mentions: string[];
  // The post quoted, read with the viewer's visibility; nickname and excerpt are null when the
  // viewer may not see it (deleted, hidden, or by an account hidden from them).
  quote: { id: string; nickname: string | null; excerpt: string | null } | null;
  createdAt: string;
  edited: boolean;
  own: boolean;
  editableUntil: string | null;
  canHide: boolean;
  canRestore: boolean;
  canBan: boolean;
}

export interface ThreadView {
  id: string;
  title: string;
  place: ForumPlace;
  path: string;
  starter: string | null;
  hidden: boolean;
  canHide: boolean;
  canRestore: boolean;
  followed: boolean;
  // The community whose writers the viewer may ban (author's forum, task 79).
  moderatedAuthorId: string | null;
  posts: PostView[];
}

type RawPost = Pick<
  ForumPostFields,
  | "userId"
  | "body"
  | "quotePostId"
  | "createdAt"
  | "editedAt"
  | "deletedAt"
  | "hidden"
> & { _id: Types.ObjectId };

async function authorsOf(userIds: Types.ObjectId[]) {
  const ids = [...new Set(userIds.map(String))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, nickname: { $type: "string" } })
      .select({ nickname: 1, role: 1 })
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
  return {
    admins: new Set(
      users.filter((user) => isAdmin(user)).map(({ _id }) => _id.toString()),
    ),
    authors: new Map(
      users.map(({ _id, nickname }) => [
        _id.toString(),
        { nickname: nickname!, avatar: avatars.get(_id.toString()) ?? null },
      ]),
    ),
  };
}

// Who the viewer may hide and ban among the writers, by the forum's rules; nothing without a role.
async function moderationRules(
  viewerId: string | null,
  place: ForumPlace,
  role: ForumRole | null,
  admins: Set<string>,
) {
  if (!viewerId || !role) return null;
  const moderators =
    place.scope === "author"
      ? await moderatorIdsOf(place.authorId)
      : new Set(place.moderatorIds);
  return (writerId: string, action: "hide" | "ban") => {
    if (writerId === viewerId) return false;
    if (place.scope === "global") {
      if (action === "ban") return false;
      return (
        role === "admin" || (!moderators.has(writerId) && !admins.has(writerId))
      );
    }
    if (writerId === place.authorId) return false;
    if (
      moderators.has(writerId) &&
      (role === "moderator" || action === "ban")
    ) {
      return false;
    }
    return true;
  };
}

// The thread's posts, oldest first. Posts of accounts the viewer must not see are left out (D80);
// a moderator's hiding and a deleted first post leave a placeholder.
export async function getThread(
  viewerId: string | null,
  threadId: string,
): Promise<ThreadView | null> {
  const found = await findVisibleThread(viewerId, threadId);
  if (!found) return null;
  const { thread, place, role, hidden } = found;
  const [posts, followed] = await Promise.all([
    ForumPost.find({ threadId: thread._id, userId: { $nin: hidden } })
      .sort({ createdAt: 1, _id: 1 })
      .limit(POSTS_SHOWN)
      .select({
        userId: 1,
        body: 1,
        quotePostId: 1,
        createdAt: 1,
        editedAt: 1,
        deletedAt: 1,
        hidden: 1,
      })
      .lean<RawPost[]>(),
    viewerId
      ? ThreadFollow.exists({ userId: viewerId, threadId: thread._id })
      : null,
  ]);
  const quoteIds = posts.flatMap(({ quotePostId }) => quotePostId ?? []);
  const quoted =
    quoteIds.length === 0
      ? []
      : await ForumPost.find({
          _id: { $in: quoteIds },
          deletedAt: null,
          hidden: { $exists: false },
          userId: { $nin: hidden },
        })
          .select({ userId: 1, body: 1 })
          .lean();
  const visibleRaw = posts.filter(
    ({ deletedAt, hidden: hiddenBy }) => !deletedAt && !hiddenBy,
  );
  const [{ authors, admins }, resolved] = await Promise.all([
    authorsOf([
      thread.userId,
      ...posts.map(({ userId }) => userId),
      ...quoted.map(({ userId }) => userId),
    ]),
    resolveMentions(
      visibleRaw.map(({ userId, body }) => ({ writerId: userId, body })),
      hidden,
    ),
  ]);
  const may = await moderationRules(viewerId, place, role, admins);
  const mentionsOf = new Map(
    visibleRaw.map(({ _id }, index) => [_id.toString(), resolved[index]]),
  );
  const quotedBy = new Map(
    quoted.flatMap(({ _id, userId, body }) => {
      const author = authors.get(userId.toString());
      const excerpt =
        body.length > QUOTE_EXCERPT
          ? `${body.slice(0, QUOTE_EXCERPT).trimEnd()}…`
          : body;
      return author
        ? [[_id.toString(), { nickname: author.nickname, excerpt }] as const]
        : [];
    }),
  );
  const now = Date.now();
  const views = posts.flatMap((post): PostView[] => {
    const author = authors.get(post.userId.toString());
    const state = post.deletedAt
      ? "deleted"
      : post.hidden
        ? "hidden"
        : "visible";
    if (!author && state === "visible") return [];
    const own = viewerId !== null && post.userId.equals(viewerId);
    const editableUntil = post.createdAt.getTime() + POST_EDIT_MS;
    const visible = state === "visible";
    const quoteId = post.quotePostId?.toString();
    const quoteBy = quoteId ? quotedBy.get(quoteId) : undefined;
    return [
      {
        id: post._id.toString(),
        state,
        author: visible ? author! : null,
        body: visible ? post.body : null,
        mentions: visible ? (mentionsOf.get(post._id.toString()) ?? []) : [],
        quote:
          visible && quoteId
            ? {
                id: quoteId,
                nickname: quoteBy?.nickname ?? null,
                excerpt: quoteBy?.excerpt ?? null,
              }
            : null,
        createdAt: post.createdAt.toISOString(),
        edited: visible && post.editedAt !== undefined,
        own: own && visible,
        editableUntil:
          own && visible && editableUntil > now
            ? new Date(editableUntil).toISOString()
            : null,
        canHide: visible && !!may?.(post.userId.toString(), "hide"),
        canRestore:
          state === "hidden" && !!may?.(post.userId.toString(), "hide"),
        canBan: visible && !!may?.(post.userId.toString(), "ban"),
      },
    ];
  });
  const mayThread = !!may?.(thread.userId.toString(), "hide");
  return {
    id: thread._id.toString(),
    title: thread.title,
    place,
    path: threadPath(place, thread._id.toString()),
    starter: authors.get(thread.userId.toString())?.nickname ?? null,
    hidden: Boolean(thread.hidden),
    canHide: !thread.hidden && mayThread,
    canRestore: Boolean(thread.hidden) && mayThread,
    followed: followed !== null,
    moderatedAuthorId: place.scope === "author" && role ? place.authorId : null,
    posts: views,
  };
}

// Whether the viewer may start threads and write posts here, for showing the forms; the actions
// check the same again.
export async function canWriteIn(
  viewerId: string | null,
  place: ForumPlace,
): Promise<boolean> {
  if (!viewerId) return false;
  await connectDB();
  const viewer = await User.findById(viewerId)
    .select({ nickname: 1, role: 1 })
    .lean();
  if (!viewer?.nickname) return false;
  if (
    place.scope === "global" &&
    place.category.adminOnly &&
    !isAdmin(viewer)
  ) {
    return false;
  }
  return (await forumPermission(viewerId, place, "forumPost", [])).ok;
}

// Followers to tell of a new post: those who see the thread. A thread hidden meanwhile only for
// its moderators; a follower who blocked its starter or the forum's author does not see it.
export async function threadReplyRecipients(
  threadId: Types.ObjectId,
  exclude: Types.ObjectId[],
): Promise<Types.ObjectId[]> {
  await connectDB();
  const [thread, followers] = await Promise.all([
    ForumThread.findOne({ _id: threadId, deletedAt: null })
      .select({ scope: 1, categoryId: 1, authorId: 1, userId: 1, hidden: 1 })
      .lean(),
    ThreadFollow.distinct("userId", { threadId }) as Promise<Types.ObjectId[]>,
  ]);
  if (!thread) return [];
  const skipped = new Set(exclude.map(String));
  let ids = followers.filter((id) => !skipped.has(id.toString()));
  if (thread.hidden) {
    const moderators = new Set<string>();
    if (thread.scope === "author" && thread.authorId) {
      moderators.add(thread.authorId.toString());
      for (const id of await moderatorIdsOf(thread.authorId.toString())) {
        moderators.add(id);
      }
    } else {
      const [category, admins] = await Promise.all([
        ForumCategory.findById(thread.categoryId)
          .select({ moderatorIds: 1 })
          .lean(),
        User.find({ role: "admin" }).select({ _id: 1 }).lean(),
      ]);
      for (const id of category?.moderatorIds ?? [])
        moderators.add(id.toString());
      for (const { _id } of admins) moderators.add(_id.toString());
    }
    ids = ids.filter((id) => moderators.has(id.toString()));
  }
  if (ids.length === 0) return [];
  const owners = [thread.userId, ...(thread.authorId ? [thread.authorId] : [])];
  const blockers = new Set(
    (
      (await Block.distinct("blockerId", {
        blockerId: { $in: ids },
        blockedId: { $in: owners },
      })) as Types.ObjectId[]
    ).map(String),
  );
  return ids.filter((id) => !blockers.has(id.toString()));
}
