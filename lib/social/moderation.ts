import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Comment } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Folder } from "@/lib/models/folder";
import { ForumPost } from "@/lib/models/forum-post";
import { Report } from "@/lib/models/report";
import {
  ModerationLog,
  type ModerationLogFields,
} from "@/lib/models/moderation-log";
import { Story } from "@/lib/models/story";
import { NOT_DELETED, User } from "@/lib/models/user";
import { chapterPublicPath, folderPublicPath } from "@/lib/publish/queries";
import { commentAnchor, moderationFor } from "@/lib/social/comments";
import { authorForumPath, postAnchor } from "@/lib/social/forums";
import {
  isBanActive,
  type ModerationRole,
  moderationRole,
  moderatorIdsOf,
} from "@/lib/social/permissions";
import type { ReportReason, ReportTarget } from "@/lib/social/reports";

export const MODERATION_LIST_LIMIT = 100;
export const MODERATION_TABS = [
  "hidden",
  "reports",
  "bans",
  "moderators",
  "log",
] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number];

// Tabs only the author of the community sees: the log is for the author and the admin (D80).
const AUTHOR_TABS: ReadonlySet<ModerationTab> = new Set(["moderators", "log"]);

export function tabsFor(role: ModerationRole): ModerationTab[] {
  return MODERATION_TABS.filter(
    (tab) => role === "author" || !AUTHOR_TABS.has(tab),
  );
}

type Id = Types.ObjectId | string;

type Entry = Omit<
  ModerationLogFields,
  "createdAt" | "authorId" | "actorId" | "targetId" | "targetUserId"
> & { authorId: Id | null; actorId: Id; targetId?: Id; targetUserId?: Id };

export async function logModeration(entry: Entry): Promise<void> {
  await ModerationLog.create(entry);
}

// An author with a publication, a moderator and an invited account see the panel (D80).
// An active global ban makes the account read-only, without moderation (D80).
// A caller that already knows whether the account has a publication passes it (AppShell).
export async function hasModerationAccess(
  userId: string,
  hasPublication?: boolean,
): Promise<boolean> {
  await connectDB();
  const [user, published, moderator] = await Promise.all([
    User.findById(userId).select({ globalBan: 1 }).lean(),
    hasPublication ??
      Folder.exists({ userId, published: true, deletedAt: null }).then(
        (folder) => folder !== null,
      ),
    CommunityModerator.exists({ userId }),
  ]);
  if (!user || isBanActive(user.globalBan, new Date())) return false;
  return published || moderator !== null;
}

export interface BanNotice {
  nickname: string;
  reason: string;
  until: string | null;
}

// The banned account sees why and until when (D80); nobody else learns of the ban.
export async function activeCommunityBan(
  viewerId: string | null,
  authorId: string,
): Promise<BanNotice | null> {
  if (!viewerId || viewerId === authorId) return null;
  await connectDB();
  const [ban, author] = await Promise.all([
    CommunityBan.findOne({
      authorId,
      userId: viewerId,
      $or: [{ until: null }, { until: { $gt: new Date() } }],
    })
      .select({ reason: 1, until: 1 })
      .lean(),
    User.findById(authorId).select({ nickname: 1 }).lean(),
  ]);
  if (!ban || !author?.nickname) return null;
  return {
    nickname: author.nickname,
    reason: ban.reason,
    until: ban.until?.toISOString() ?? null,
  };
}

async function nicknamesOf(
  ids: (Types.ObjectId | undefined | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => id).map(String))];
  const users = await User.find({
    _id: { $in: unique },
    nickname: { $type: "string" },
    ...NOT_DELETED,
  })
    .select({ nickname: 1 })
    .lean();
  return new Map(users.map(({ _id, nickname }) => [_id.toString(), nickname!]));
}

// For the reactions and ratings of a chapter or book: read-only for an account banned in its
// author's community.
export async function isBannedAt(
  viewerId: string | null,
  target: { type: "story" | "folder"; id: string },
): Promise<boolean> {
  if (!viewerId) return false;
  await connectDB();
  const owner =
    target.type === "story"
      ? await Story.findById(target.id).select({ userId: 1 }).lean()
      : await Folder.findById(target.id).select({ userId: 1 }).lean();
  if (!owner || owner.userId.equals(viewerId)) return false;
  const ban = await CommunityBan.exists({
    authorId: owner.userId,
    userId: viewerId,
    $or: [{ until: null }, { until: { $gt: new Date() } }],
  });
  return ban !== null;
}

export interface Community {
  authorId: string;
  nickname: string;
  role: ModerationRole;
}

export interface Invitation {
  authorId: string;
  nickname: string;
}

export interface ModerationOverview {
  communities: Community[];
  invitations: Invitation[];
}

export async function getModerationOverview(
  userId: string,
): Promise<ModerationOverview> {
  await connectDB();
  const [self, own, roles] = await Promise.all([
    User.findById(userId).select({ nickname: 1, globalBan: 1 }).lean(),
    Folder.exists({ userId, published: true, deletedAt: null }),
    CommunityModerator.find({ userId })
      .sort({ createdAt: 1 })
      .select({ authorId: 1, state: 1 })
      .lean(),
  ]);
  if (!self || isBanActive(self.globalBan, new Date())) {
    return { communities: [], invitations: [] };
  }
  const nicknames = await nicknamesOf(roles.map(({ authorId }) => authorId));
  const named = (state: "invited" | "active") =>
    roles.flatMap(({ authorId, state: current }) => {
      const nickname = nicknames.get(authorId.toString());
      return current === state && nickname
        ? [{ authorId: authorId.toString(), nickname }]
        : [];
    });
  return {
    communities: [
      ...(own && self.nickname
        ? [
            {
              authorId: userId,
              nickname: self.nickname,
              role: "author" as const,
            },
          ]
        : []),
      ...named("active").map((community) => ({
        ...community,
        role: "moderator" as const,
      })),
    ],
    invitations: named("invited"),
  };
}

// The public page of each comment's place, looked up once per chapter or book.
function commentPlacePaths(authorId: string) {
  const paths = new Map<string, Promise<string>>();
  return (folderId: Types.ObjectId, storyId: Types.ObjectId | null) => {
    const key = `${folderId.toString()}/${storyId?.toString() ?? ""}`;
    if (!paths.has(key)) {
      paths.set(
        key,
        storyId
          ? chapterPublicPath(authorId, folderId.toString(), storyId.toString())
          : folderPublicPath(authorId, folderId.toString()),
      );
    }
    return paths.get(key)!;
  };
}

export interface HiddenCommentView {
  id: string;
  writer: string | null;
  body: string;
  reason: string | null;
  hiddenBy: string | null;
  hiddenAt: string;
  purgeAt: string | null;
  path: string;
}

export async function listHiddenComments(
  authorId: string,
): Promise<HiddenCommentView[]> {
  await connectDB();
  const comments = await Comment.find({
    authorId,
    hidden: { $exists: true },
    deletedAt: null,
  })
    .sort({ "hidden.at": -1 })
    .limit(MODERATION_LIST_LIMIT)
    .select({
      userId: 1,
      body: 1,
      hidden: 1,
      purgeAt: 1,
      folderId: 1,
      storyId: 1,
    })
    .lean();
  const nicknames = await nicknamesOf(
    comments.flatMap(({ userId, hidden }) => [userId, hidden?.by]),
  );
  const pathOf = commentPlacePaths(authorId);
  return Promise.all(
    comments.map(async (comment) => ({
      id: comment._id.toString(),
      writer: nicknames.get(comment.userId.toString()) ?? null,
      body: comment.body,
      reason: comment.hidden!.reason ?? null,
      hiddenBy: nicknames.get(comment.hidden!.by.toString()) ?? null,
      hiddenAt: comment.hidden!.at.toISOString(),
      purgeAt: comment.purgeAt?.toISOString() ?? null,
      path: `${await pathOf(comment.folderId, comment.storyId)}#${commentAnchor(comment._id.toString())}`,
    })),
  );
}

export interface BanView {
  nickname: string;
  reason: string;
  until: string | null;
  by: string | null;
  createdAt: string;
}

export async function listCommunityBans(authorId: string): Promise<BanView[]> {
  await connectDB();
  const bans = await CommunityBan.find({
    authorId,
    $or: [{ until: null }, { until: { $gt: new Date() } }],
  })
    .sort({ createdAt: -1 })
    .limit(MODERATION_LIST_LIMIT)
    .lean();
  const nicknames = await nicknamesOf(
    bans.flatMap(({ userId, by }) => [userId, by]),
  );
  return bans.flatMap((ban) => {
    const nickname = nicknames.get(ban.userId.toString());
    return nickname
      ? [
          {
            nickname,
            reason: ban.reason,
            until: ban.until?.toISOString() ?? null,
            by: nicknames.get(ban.by.toString()) ?? null,
            createdAt: ban.createdAt.toISOString(),
          },
        ]
      : [];
  });
}

export interface ModeratorView {
  nickname: string;
  state: "invited" | "active";
}

export async function listModerators(
  authorId: string,
): Promise<ModeratorView[]> {
  await connectDB();
  const moderators = await CommunityModerator.find({ authorId })
    .sort({ createdAt: 1 })
    .select({ userId: 1, state: 1 })
    .lean();
  const nicknames = await nicknamesOf(moderators.map(({ userId }) => userId));
  return moderators.flatMap(({ userId, state }) => {
    const nickname = nicknames.get(userId.toString());
    return nickname ? [{ nickname, state }] : [];
  });
}

export interface LogEntryView {
  id: string;
  action: ModerationLogFields["action"];
  targetType: ModerationLogFields["targetType"];
  actor: string | null;
  target: string | null;
  reason: string | null;
  createdAt: string;
}

export async function listModerationLog(
  authorId: string,
): Promise<LogEntryView[]> {
  await connectDB();
  const entries = await ModerationLog.find({ authorId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(MODERATION_LIST_LIMIT)
    .lean();
  const nicknames = await nicknamesOf(
    entries.flatMap(({ actorId, targetUserId }) => [actorId, targetUserId]),
  );
  return entries.map((entry) => ({
    id: entry._id.toString(),
    action: entry.action,
    targetType: entry.targetType,
    actor: nicknames.get(entry.actorId.toString()) ?? null,
    target: entry.targetUserId
      ? (nicknames.get(entry.targetUserId.toString()) ?? null)
      : null,
    reason: entry.reason ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));
}

export interface ReportedComment {
  id: string;
  body: string;
  state: "visible" | "hidden";
  path: string;
  canHide: boolean;
  canBan: boolean;
}

// The reporter is not shown to the community: only the admin sees who reported (task 80).
export interface CommunityReportView {
  id: string;
  writer: string | null;
  reason: ReportReason;
  details: string;
  createdAt: string;
  // null once the comment is deleted or purged.
  comment: ReportedComment | null;
}

// Open reports of comments in authorId's community, newest first. A moderator does not see
// reports about themselves or another moderator (as canModerate); nobody else sees any.
export async function listCommunityReports(
  viewerId: string,
  authorId: string,
): Promise<CommunityReportView[]> {
  await connectDB();
  const role = await moderationRole(viewerId, authorId);
  if (!role) return [];
  const excluded =
    role === "moderator" ? [viewerId, ...(await moderatorIdsOf(authorId))] : [];
  const reports = await Report.find({
    route: "author",
    authorId,
    state: "open",
    ...(excluded.length > 0 && { targetUserId: { $nin: excluded } }),
  })
    .sort({ createdAt: -1 })
    .limit(MODERATION_LIST_LIMIT)
    .select({
      targetType: 1,
      targetId: 1,
      targetUserId: 1,
      reason: 1,
      details: 1,
      createdAt: 1,
    })
    .lean();
  const postIds = reports
    .filter(({ targetType }) => targetType === "post")
    .map(({ targetId }) => targetId);
  const [comments, posts, author, nicknames, may] = await Promise.all([
    Comment.find({
      _id: { $in: reports.map(({ targetId }) => targetId) },
      deletedAt: null,
    })
      .select({ body: 1, hidden: 1, folderId: 1, storyId: 1, userId: 1 })
      .lean(),
    postIds.length === 0
      ? []
      : ForumPost.find({ _id: { $in: postIds }, deletedAt: null })
          .select({ body: 1, hidden: 1, threadId: 1 })
          .lean(),
    User.findById(authorId).select({ nickname: 1 }).lean(),
    nicknamesOf(reports.map(({ targetUserId }) => targetUserId)),
    moderationFor(viewerId, authorId),
  ]);
  const byId = new Map(
    comments.map((comment) => [comment._id.toString(), comment]),
  );
  const postById = new Map(posts.map((post) => [post._id.toString(), post]));
  const pathOf = commentPlacePaths(authorId);
  return Promise.all(
    reports.map(async (report) => {
      const writerId = report.targetUserId.toString();
      // A forum post is shown in its thread, where it is hidden from its menu (task 87).
      if (report.targetType === "post") {
        const post = postById.get(report.targetId.toString());
        return {
          id: report._id.toString(),
          writer: nicknames.get(writerId) ?? null,
          reason: report.reason,
          details: report.details,
          createdAt: report.createdAt.toISOString(),
          comment:
            post && author?.nickname
              ? {
                  id: post._id.toString(),
                  body: post.body,
                  state: post.hidden
                    ? ("hidden" as const)
                    : ("visible" as const),
                  path: `${authorForumPath(author.nickname)}/${post.threadId.toString()}#${postAnchor(post._id.toString())}`,
                  canHide: false,
                  canBan: !!may?.(writerId, "ban"),
                }
              : null,
        };
      }
      const comment = byId.get(report.targetId.toString());
      return {
        id: report._id.toString(),
        writer: nicknames.get(writerId) ?? null,
        reason: report.reason,
        details: report.details,
        createdAt: report.createdAt.toISOString(),
        comment: comment
          ? {
              id: comment._id.toString(),
              body: comment.body,
              state: comment.hidden
                ? ("hidden" as const)
                : ("visible" as const),
              path: `${await pathOf(comment.folderId, comment.storyId)}#${commentAnchor(comment._id.toString())}`,
              canHide: !comment.hidden && !!may?.(writerId, "hide"),
              canBan: !!may?.(writerId, "ban"),
            }
          : null,
      };
    }),
  );
}

export interface AdminReportView {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  target: string | null;
  reporter: string | null;
  reason: ReportReason;
  details: string;
  createdAt: string;
}

// The admin's queue, only behind isActiveAdmin (lib/social/admin.ts): reports outside any
// community, with the reporter.
export async function listAdminReports(): Promise<AdminReportView[]> {
  await connectDB();
  const reports = await Report.find({
    route: "admin",
    authorId: null,
    state: "open",
  })
    .sort({ createdAt: -1 })
    .limit(MODERATION_LIST_LIMIT)
    .select({
      targetType: 1,
      targetId: 1,
      targetUserId: 1,
      reporterId: 1,
      reason: 1,
      details: 1,
      createdAt: 1,
    })
    .lean();
  const nicknames = await nicknamesOf(
    reports.flatMap(({ targetUserId, reporterId }) => [
      targetUserId,
      reporterId,
    ]),
  );
  return reports.map((report) => ({
    id: report._id.toString(),
    targetType: report.targetType,
    targetId: report.targetId.toString(),
    target: nicknames.get(report.targetUserId.toString()) ?? null,
    reporter: nicknames.get(report.reporterId.toString()) ?? null,
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt.toISOString(),
  }));
}
