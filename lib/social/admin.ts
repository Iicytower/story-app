import { Types } from "mongoose";
import { profilePath } from "@/components/user-link";
import { routing } from "@/i18n/routing";
import { connectDB } from "@/lib/db";
import { Comment } from "@/lib/models/comment";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumPost } from "@/lib/models/forum-post";
import { ForumThread } from "@/lib/models/forum-thread";
import {
  ModerationLog,
  type ModerationLogFields,
} from "@/lib/models/moderation-log";
import { Story } from "@/lib/models/story";
import { NICKNAME_COLLATION, NOT_DELETED, User } from "@/lib/models/user";
import {
  chapterPublicPath,
  folderPublicPath,
  publicTargetIds,
} from "@/lib/publish/queries";
import { commentAnchor } from "@/lib/social/comments";
import { postAnchor, threadPath } from "@/lib/social/forums";
import {
  type AdminReportView,
  listAdminReports,
} from "@/lib/social/moderation";
import { isAdmin, isBanActive } from "@/lib/social/permissions";

export const ADMIN_TABS = [
  "reports",
  "bans",
  "adult",
  "categories",
  "tags",
  "log",
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export const ADMIN_LIST_LIMIT = 100;
export const ADMIN_LOG_PAGE = 50;
export const ADMIN_LOG_MAX_PAGE = 1000;

// The admin panel and its actions (D80): the role without an active global ban.
export async function isActiveAdmin(userId: string): Promise<boolean> {
  await connectDB();
  const user = await User.findById(userId)
    .select({ role: 1, globalBan: 1 })
    .lean();
  return isAdmin(user) && !isBanActive(user!.globalBan, new Date());
}

export function findUserByNick(nickname: string) {
  return User.findOne({ nickname: nickname.trim(), ...NOT_DELETED })
    .collation(NICKNAME_COLLATION)
    .select({ _id: 1, nickname: 1, role: 1, globalBan: 1 })
    .lean();
}

async function nicknamesOf(
  ids: (Types.ObjectId | undefined | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => id).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({
    _id: { $in: unique },
    nickname: { $type: "string" },
    ...NOT_DELETED,
  })
    .select({ nickname: 1 })
    .lean();
  return new Map(users.map(({ _id, nickname }) => [_id.toString(), nickname!]));
}

export interface GlobalBanView {
  nickname: string;
  until: string | null;
  reason: string;
  by: string | null;
  at: string;
}

// Active bans only, newest first; the partial index on globalBan.until keeps it to banned accounts.
export async function listGlobalBans(): Promise<GlobalBanView[]> {
  await connectDB();
  const users = await User.find({
    globalBan: { $exists: true },
    $or: [
      { "globalBan.until": null },
      { "globalBan.until": { $gt: new Date() } },
    ],
    nickname: { $type: "string" },
    ...NOT_DELETED,
  })
    .sort({ "globalBan.at": -1, _id: -1 })
    .limit(ADMIN_LIST_LIMIT)
    .select({ nickname: 1, globalBan: 1 })
    .lean();
  const admins = await nicknamesOf(users.map(({ globalBan }) => globalBan!.by));
  return users.map(({ nickname, globalBan }) => ({
    nickname,
    until: globalBan!.until?.toISOString() ?? null,
    reason: globalBan!.reason,
    by: admins.get(globalBan!.by.toString()) ?? null,
    at: globalBan!.at.toISOString(),
  }));
}

export interface AdminLogEntry {
  id: string;
  action: ModerationLogFields["action"];
  targetType: ModerationLogFields["targetType"];
  // The community's author; null for a step of the whole site.
  community: string | null;
  actor: string | null;
  target: string | null;
  targetKey: string | null;
  reason: string | null;
  createdAt: string;
}

// Every community and the whole site, newest first; `author` keeps one author's community.
export async function listAdminLog({
  author,
  page,
}: {
  author?: string;
  page: number;
}): Promise<{ entries: AdminLogEntry[]; more: boolean }> {
  await connectDB();
  let filter = {};
  if (author) {
    const user = await findUserByNick(author);
    if (!user) return { entries: [], more: false };
    filter = { authorId: user._id };
  }
  const safePage = Number.isSafeInteger(page)
    ? Math.min(Math.max(page, 0), ADMIN_LOG_MAX_PAGE)
    : 0;
  const found = await ModerationLog.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(safePage * ADMIN_LOG_PAGE)
    .limit(ADMIN_LOG_PAGE + 1)
    .lean();
  const entries = found.slice(0, ADMIN_LOG_PAGE);
  const nicknames = await nicknamesOf(
    entries.flatMap(({ actorId, targetUserId, authorId }) => [
      actorId,
      targetUserId,
      authorId,
    ]),
  );
  const nick = (id: Types.ObjectId | null | undefined) =>
    id ? (nicknames.get(id.toString()) ?? null) : null;
  return {
    more: found.length > ADMIN_LOG_PAGE,
    entries: entries.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      targetType: entry.targetType,
      community: entry.authorId ? (nick(entry.authorId) ?? "") : null,
      actor: nick(entry.actorId),
      target: nick(entry.targetUserId),
      targetKey: entry.targetKey ?? null,
      reason: entry.reason ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export interface AdminReportItem extends AdminReportView {
  // What was reported, as far as it is still there.
  text: string | null;
  path: string | null;
  hidden: boolean;
  canHide: boolean;
}

// The public address of a book or chapter, or null when readers cannot open it (D38): in the
// bin, unpublished, hidden, or by an account without a nickname.
async function publicPlacePath(
  authorId: Types.ObjectId,
  folderId: Types.ObjectId,
  storyId: Types.ObjectId | null,
): Promise<string | null> {
  const [author, folder, chapter] = await Promise.all([
    User.exists({
      _id: authorId,
      nickname: { $type: "string" },
      ...NOT_DELETED,
    }),
    Folder.exists({
      _id: folderId,
      userId: authorId,
      published: true,
      deletedAt: null,
    }),
    Story.exists({
      folderId,
      userId: authorId,
      publication: "public",
      deletedAt: null,
      ...(storyId && { _id: storyId }),
    }),
  ]);
  if (!author || !folder || !chapter) return null;
  return storyId
    ? chapterPublicPath(
        authorId.toString(),
        folderId.toString(),
        storyId.toString(),
      )
    : folderPublicPath(authorId.toString(), folderId.toString());
}

async function reportPreview(
  report: AdminReportView,
): Promise<Pick<AdminReportItem, "text" | "path" | "hidden" | "canHide">> {
  const gone = { text: null, path: null, hidden: false, canHide: false };
  const id = new Types.ObjectId(report.targetId);
  switch (report.targetType) {
    case "comment": {
      const comment = await Comment.findOne({ _id: id, deletedAt: null })
        .select({ body: 1, hidden: 1, authorId: 1, folderId: 1, storyId: 1 })
        .lean();
      if (!comment) return gone;
      const place = await publicPlacePath(
        comment.authorId,
        comment.folderId,
        comment.storyId ?? null,
      );
      return {
        text: comment.body,
        path: place && `${place}#${commentAnchor(comment._id.toString())}`,
        hidden: Boolean(comment.hidden),
        canHide: !comment.hidden,
      };
    }
    case "post": {
      const post = await ForumPost.findOne({ _id: id, deletedAt: null })
        .select({ body: 1, hidden: 1, threadId: 1 })
        .lean();
      if (!post) return gone;
      const thread = await ForumThread.findOne({
        _id: post.threadId,
        deletedAt: null,
      })
        .select({ scope: 1, authorId: 1, categoryId: 1 })
        .lean();
      const owner =
        thread?.scope === "author" && thread.authorId
          ? await User.findById(thread.authorId).select({ nickname: 1 }).lean()
          : null;
      const category =
        thread?.scope === "global" && thread.categoryId
          ? await ForumCategory.exists({ _id: thread.categoryId })
          : null;
      const path = category
        ? threadPath({ scope: "global" }, post.threadId.toString())
        : owner?.nickname
          ? threadPath(
              { scope: "author", nickname: owner.nickname },
              post.threadId.toString(),
            )
          : null;
      return {
        text: post.body,
        path: path && `${path}#${postAnchor(post._id.toString())}`,
        hidden: Boolean(post.hidden),
        canHide: !post.hidden && thread !== null,
      };
    }
    case "story": {
      const story = await Story.findOne({ _id: id, deletedAt: null })
        .select({ title: 1, userId: 1, folderId: 1 })
        .lean();
      if (!story) return gone;
      return {
        ...gone,
        text: story.title,
        path: await publicPlacePath(story.userId, story.folderId, story._id),
      };
    }
    case "folder": {
      const folder = await Folder.findOne({ _id: id, deletedAt: null })
        .select({ name: 1, userId: 1 })
        .lean();
      if (!folder) return gone;
      return {
        ...gone,
        text: folder.name,
        path: await publicPlacePath(folder.userId, folder._id, null),
      };
    }
    case "profile":
      return {
        ...gone,
        path: report.target ? profilePath(report.target) : null,
      };
  }
}

// Only behind isActiveAdmin: the queue names the reporter (task 80).
export async function listAdminQueue(): Promise<AdminReportItem[]> {
  const reports = await listAdminReports();
  return Promise.all(
    reports.map(async (report) => ({
      ...report,
      ...(await reportPreview(report)),
    })),
  );
}

export type AdultTarget =
  | {
      type: "folder" | "story";
      id: string;
      name: string;
      admin: boolean | null;
    }
  | { type: "cover"; id: string; name: string; admin: boolean | null };

// The path of a public address, also of a full URL, without the language prefix.
function publicPath(address: string): string[] | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(address.trim(), "http://local").pathname);
  } catch {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  if ((routing.locales as readonly string[]).includes(segments[0])) {
    segments.shift();
  }
  return segments;
}

// A folder, chapter or cover by the address readers see (task 88); nothing else is found.
export async function findAdultTarget(
  address: string,
): Promise<AdultTarget | null> {
  const segments = publicPath(address);
  if (!segments) return null;
  await connectDB();
  if (segments[0] === "covers" && segments.length === 2) {
    if (!Types.ObjectId.isValid(segments[1])) return null;
    const cover = await Cover.findOne({ _id: segments[1], state: "rated" })
      .select({ folderId: 1, adminAdult: 1 })
      .lean();
    if (!cover) return null;
    const folder = await Folder.findOne({
      _id: cover.folderId,
      coverId: cover._id,
      published: true,
      deletedAt: null,
    })
      .select({ name: 1 })
      .lean();
    if (!folder) return null;
    return {
      type: "cover",
      id: cover._id.toString(),
      name: folder.name,
      admin: cover.adminAdult ?? null,
    };
  }
  if (segments[0] !== "p" || segments.length < 3 || segments.length > 4) {
    return null;
  }
  const [, nickname, folderSlug, chapterSlug] = segments;
  const found = await publicTargetIds(nickname, folderSlug, chapterSlug);
  if (!found) return null;
  if (found.storyId) {
    const story = await Story.findById(found.storyId)
      .select({ title: 1, adult: 1 })
      .lean();
    return (
      story && {
        type: "story",
        id: found.storyId,
        name: story.title,
        admin: story.adult?.admin ?? null,
      }
    );
  }
  const folder = await Folder.findById(found.folderId)
    .select({ name: 1, adult: 1 })
    .lean();
  return (
    folder && {
      type: "folder",
      id: found.folderId,
      name: folder.name,
      admin: folder.adult?.admin ?? null,
    }
  );
}

export interface AdminCategoryView {
  key: string;
  labels: { en: string; pl: string };
  adminOnly: boolean;
  moderators: string[];
}

export async function listAdminCategories(): Promise<AdminCategoryView[]> {
  await connectDB();
  const categories = await ForumCategory.find()
    .sort({ order: 1, _id: 1 })
    .lean();
  const nicknames = await nicknamesOf(
    categories.flatMap(({ moderatorIds }) => moderatorIds),
  );
  return categories.map((category) => ({
    key: category._id,
    labels: category.labels,
    adminOnly: Boolean(category.adminOnly),
    moderators: category.moderatorIds.flatMap((id) => {
      const nickname = nicknames.get(id.toString());
      return nickname ? [nickname] : [];
    }),
  }));
}
