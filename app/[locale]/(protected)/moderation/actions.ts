"use server";

import { refresh } from "next/cache";
import type { Types } from "mongoose";
import { isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { countError, lengthError, MAX_MODERATORS } from "@/lib/limits";
import { Block } from "@/lib/models/block";
import { Comment } from "@/lib/models/comment";
import { CommunityBan } from "@/lib/models/community-ban";
import { CommunityModerator } from "@/lib/models/community-moderator";
import { Reaction } from "@/lib/models/reaction";
import { Report } from "@/lib/models/report";
import { NICKNAME_COLLATION, NOT_DELETED, User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import {
  hideForumContent,
  restoreForumContent,
} from "@/lib/social/forum-moderation";
import { applyCommentHide } from "@/lib/social/comment-moderation";
import { logModeration } from "@/lib/social/moderation";
import { notifyLater } from "@/lib/social/notify";
import {
  canModerate,
  isAdmin,
  isBanActive,
  isModeratorOf,
  moderationRole,
} from "@/lib/social/permissions";
import { REPORT_OUTCOMES, type ReportOutcome } from "@/lib/social/reports";

const DAY_MS = 24 * 60 * 60 * 1000;
export type BanDuration = 1 | 7 | 30 | null;
const DURATIONS: readonly unknown[] = [1, 7, 30, null];

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const rateLimited = () => actionError("RATE_LIMITED", "tooManyAttempts");
const commentNotFound = () => actionError("NOT_FOUND", "commentNotFound");
const communityNotFound = () => actionError("NOT_FOUND", "communityNotFound");
const userNotFound = () => actionError("NOT_FOUND", "userNotFound");
const refused = () => actionError("FORBIDDEN", "interactionNotAllowed");
const cannotModerate = () => actionError("FORBIDDEN", "cannotModerate");

// The per-account limit shared by every moderation step (task 79), after the input guards.
async function limitError(userId: string): Promise<ActionError | null> {
  if (!(await takeUserAttempt(SOCIAL_LIMITS.moderate, userId))) {
    return rateLimited();
  }
  await connectDB();
  return null;
}

async function findByNickname(nickname: string) {
  return User.findOne({ nickname, ...NOT_DELETED })
    .collation(NICKNAME_COLLATION)
    .select({ _id: 1, globalBan: 1 })
    .lean();
}

// An optional reason, trimmed; empty means none.
async function optionalReason(
  value: unknown,
): Promise<string | undefined | ActionError> {
  if (value === undefined || value === null) return undefined;
  if (!isString(value)) return invalid();
  const reason = value.trim();
  const tooLong = lengthError("hideReason", reason);
  if (tooLong) return translateError(tooLong);
  return reason || undefined;
}

// The community is the comment's: authorId never comes from the client here (task 79).
async function findModeratedComment(userId: string, commentId: string) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null })
    .select({ authorId: 1, userId: 1, hidden: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!comment) return null;
  const role = await moderationRole(userId, comment.authorId.toString());
  return role ? { comment, role } : null;
}

export type HideTarget = "comment" | "post" | "thread";

const isForumTarget = (value: unknown): value is "post" | "thread" =>
  value === "post" || value === "thread";

// Forum posts and threads (task 87) by the forum's moderators; comments by the community's.
export async function hideContent(
  targetType: HideTarget,
  id: string,
  reason?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if ((targetType !== "comment" && !isForumTarget(targetType)) || !isId(id)) {
    return invalid();
  }
  const text = await optionalReason(reason);
  if (typeof text === "object") return text;
  const limited = await limitError(user.userId);
  if (limited) return limited;
  if (isForumTarget(targetType)) {
    const result = await hideForumContent(user.userId, targetType, id, text);
    if (result.ok) refresh();
    return result;
  }
  const found = await findModeratedComment(user.userId, id);
  if (!found) return commentNotFound();
  const { comment, role } = found;
  const permission = await canModerate(user.userId, {
    authorId: comment.authorId.toString(),
    role,
    targetId: comment.userId.toString(),
    action: "hide",
  });
  if (!permission.ok) return translateError(permission);
  await applyCommentHide(user.userId, comment, text, {
    authorId: comment.authorId,
  });
  refresh();
  return { ok: true };
}

export async function restoreContent(
  targetType: HideTarget,
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if ((targetType !== "comment" && !isForumTarget(targetType)) || !isId(id)) {
    return invalid();
  }
  const limited = await limitError(user.userId);
  if (limited) return limited;
  if (isForumTarget(targetType)) {
    const result = await restoreForumContent(user.userId, targetType, id);
    if (result.ok) refresh();
    return result;
  }
  const found = await findModeratedComment(user.userId, id);
  if (!found?.comment.hidden) return commentNotFound();
  const { comment, role } = found;
  const permission = await canModerate(user.userId, {
    authorId: comment.authorId.toString(),
    role,
    targetId: comment.userId.toString(),
    action: "hide",
  });
  if (!permission.ok) return translateError(permission);

  const { modifiedCount } = await Comment.updateOne(
    { _id: comment._id, hidden: { $exists: true } },
    { $unset: { hidden: 1, purgeAt: 1 } },
  );
  if (modifiedCount === 0) return commentNotFound();
  await Reaction.updateMany(
    { targetType: "comment", targetId: comment._id },
    { $unset: { purgeAt: 1 } },
  );
  await logModeration({
    authorId: comment.authorId,
    actorId: user.userId,
    action: "restore",
    targetType: "comment",
    targetId: comment._id,
    targetUserId: comment.userId,
  });
  refresh();
  return { ok: true };
}

// Who may not hold a role in authorId's community: an account with an active global ban, or
// one banned there or blocked either way (D80).
async function roleBar(
  authorId: string | Types.ObjectId,
  userId: string | Types.ObjectId,
): Promise<"globalBan" | "barred" | null> {
  const now = new Date();
  const [user, blocked, banned] = await Promise.all([
    User.findById(userId).select({ globalBan: 1 }).lean(),
    Block.exists({
      $or: [
        { blockerId: authorId, blockedId: userId },
        { blockerId: userId, blockedId: authorId },
      ],
    }),
    CommunityBan.findOne({ authorId, userId }).select({ until: 1 }).lean(),
  ]);
  if (!user || isBanActive(user.globalBan, now)) return "globalBan";
  return blocked || isBanActive(banned, now) ? "barred" : null;
}

async function globallyBanned(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select({ globalBan: 1 }).lean();
  return !user || isBanActive(user.globalBan, new Date());
}

// The author or a moderator of authorId's community, else NOT_FOUND (D80).
async function communityTarget(
  userId: string,
  authorId: string,
  nickname: string,
) {
  const role = await moderationRole(userId, authorId);
  if (!role) return communityNotFound();
  const target = await findByNickname(nickname);
  if (!target) return userNotFound();
  return { role, targetId: target._id };
}

export async function banFromCommunity(
  authorId: string,
  nickname: string,
  duration: BanDuration,
  reason: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (
    !isId(authorId) ||
    !isString(nickname) ||
    !DURATIONS.includes(duration) ||
    !isString(reason)
  ) {
    return invalid();
  }
  const text = reason.trim();
  if (!text) return actionError("INVALID_INPUT", "banReasonRequired");
  const tooLong = lengthError("banReason", text);
  if (tooLong) return translateError(tooLong);
  const limited = await limitError(user.userId);
  if (limited) return limited;
  const found = await communityTarget(user.userId, authorId, nickname);
  if ("ok" in found) return found;
  const permission = await canModerate(user.userId, {
    authorId,
    role: found.role,
    targetId: found.targetId.toString(),
    action: "ban",
  });
  if (!permission.ok) return translateError(permission);
  if (found.role === "moderator") {
    const previous = await CommunityBan.findOne({
      authorId,
      userId: found.targetId,
    })
      .select({ by: 1, until: 1 })
      .lean();
    if (previous?.by.equals(authorId) && isBanActive(previous, new Date())) {
      return cannotModerate();
    }
  }

  const until =
    duration === null ? null : new Date(Date.now() + duration * DAY_MS);
  // A new ban replaces the previous one with its own date and reason.
  await CommunityBan.deleteOne({ authorId, userId: found.targetId });
  try {
    await CommunityBan.create({
      authorId,
      userId: found.targetId,
      until,
      reason: text,
      by: user.userId,
    });
  } catch (error) {
    // A ban given at the same moment by someone else: the user is banned either way.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  // A banned account cannot take up a role there (acceptModeratorInvite checks it too).
  await CommunityModerator.deleteOne({
    authorId,
    userId: found.targetId,
    state: "invited",
  });
  await logModeration({
    authorId,
    actorId: user.userId,
    action: "ban",
    targetType: "user",
    targetId: found.targetId,
    targetUserId: found.targetId,
    reason: text,
  });
  notifyLater(found.targetId, {
    type: "ban",
    actorId: user.userId,
    authorId,
  });
  refresh();
  return { ok: true };
}

export async function liftCommunityBan(
  authorId: string,
  nickname: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(authorId) || !isString(nickname)) return invalid();
  const limited = await limitError(user.userId);
  if (limited) return limited;
  const found = await communityTarget(user.userId, authorId, nickname);
  if ("ok" in found) return found;
  const ban = await CommunityBan.findOne({ authorId, userId: found.targetId })
    .select({ by: 1 })
    .lean();
  if (!ban) return actionError("NOT_FOUND", "banNotFound");
  // The author's ban is the author's to lift (a moderator neither replaces nor lifts it).
  if (found.role === "moderator" && ban.by.equals(authorId)) {
    return cannotModerate();
  }

  const { deletedCount } = await CommunityBan.deleteOne({ _id: ban._id });
  if (deletedCount === 0) return actionError("NOT_FOUND", "banNotFound");
  await logModeration({
    authorId,
    actorId: user.userId,
    action: "unban",
    targetType: "user",
    targetId: found.targetId,
    targetUserId: found.targetId,
  });
  refresh();
  return { ok: true };
}

// The author invites by nickname; the role starts once the invitation is accepted (D80).
export async function inviteModerator(nickname: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname)) return invalid();
  const limited = await limitError(user.userId);
  if (limited) return limited;
  if ((await moderationRole(user.userId, user.userId)) !== "author") {
    return refused();
  }
  const target = await findByNickname(nickname);
  if (!target) return userNotFound();
  if (target._id.equals(user.userId)) return refused();
  const bar = await roleBar(user.userId, target._id);
  if (bar === "globalBan") return userNotFound();
  if (bar) return refused();
  if (
    await CommunityModerator.exists({
      authorId: user.userId,
      userId: target._id,
    })
  ) {
    return { ok: true };
  }
  // Invited and active together; two invitations at once may pass the count (as shelves, 72).
  const count = await CommunityModerator.countDocuments({
    authorId: user.userId,
  });
  if (count >= MAX_MODERATORS) {
    return translateError(countError("tooManyModerators"));
  }
  try {
    await CommunityModerator.create({
      authorId: user.userId,
      userId: target._id,
      state: "invited",
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return { ok: true };
  }
  // A block saved meanwhile: blockUser's cleanup may have run before this insert.
  if (await roleBar(user.userId, target._id)) {
    await CommunityModerator.deleteOne({
      authorId: user.userId,
      userId: target._id,
      state: "invited",
    });
    return refused();
  }
  await logModeration({
    authorId: user.userId,
    actorId: user.userId,
    action: "invite",
    targetType: "user",
    targetId: target._id,
    targetUserId: target._id,
  });
  // Accepted or declined from the notification.
  notifyLater(target._id, {
    type: "moderatorInvite",
    actorId: user.userId,
    authorId: user.userId,
  });
  refresh();
  return { ok: true };
}

const ROLE_NOTIFICATIONS = {
  accept: "moderatorAccepted",
  decline: "moderatorDeclined",
  resign: "moderatorResigned",
} as const;

// The invited or active moderator's own step in authorId's community.
async function ownRole(
  authorId: string,
  from: "invited" | "active",
  to: "active" | null,
  action: "accept" | "decline" | "resign",
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(authorId)) return invalid();
  const limited = await limitError(user.userId);
  if (limited) return limited;
  // Declining stays open to everyone; taking up or giving up the role is a social step.
  if (action === "accept" && (await roleBar(authorId, user.userId))) {
    return refused();
  }
  if (action === "resign" && (await globallyBanned(user.userId))) {
    return refused();
  }
  const filter = { authorId, userId: user.userId, state: from };
  const changed =
    to === "active"
      ? (await CommunityModerator.updateOne(filter, { $set: { state: to } }))
          .modifiedCount
      : (await CommunityModerator.deleteOne(filter)).deletedCount;
  if (changed === 0) {
    return actionError(
      "NOT_FOUND",
      from === "invited" ? "invitationNotFound" : "moderatorNotFound",
    );
  }
  // A block saved meanwhile: blockUser's cleanup may have run before this update.
  if (action === "accept" && (await roleBar(authorId, user.userId))) {
    await CommunityModerator.deleteOne({ authorId, userId: user.userId });
    return refused();
  }
  await logModeration({
    authorId,
    actorId: user.userId,
    action,
    targetType: "user",
    targetId: user.userId,
    targetUserId: user.userId,
  });
  notifyLater(authorId, {
    type: ROLE_NOTIFICATIONS[action],
    actorId: user.userId,
    authorId,
  });
  refresh();
  return { ok: true };
}

export async function acceptModeratorInvite(
  authorId: string,
): Promise<ActionResult> {
  return ownRole(authorId, "invited", "active", "accept");
}

export async function declineModeratorInvite(
  authorId: string,
): Promise<ActionResult> {
  return ownRole(authorId, "invited", null, "decline");
}

export async function resignModerator(authorId: string): Promise<ActionResult> {
  return ownRole(authorId, "active", null, "resign");
}

// Takes the role away, or withdraws an invitation not yet accepted.
export async function removeModerator(nickname: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(nickname)) return invalid();
  const limited = await limitError(user.userId);
  if (limited) return limited;
  if (await globallyBanned(user.userId)) return refused();
  const target = await findByNickname(nickname);
  if (!target) return userNotFound();
  const { deletedCount } = await CommunityModerator.deleteOne({
    authorId: user.userId,
    userId: target._id,
  });
  if (deletedCount === 0) return actionError("NOT_FOUND", "moderatorNotFound");
  await logModeration({
    authorId: user.userId,
    actorId: user.userId,
    action: "remove",
    targetType: "user",
    targetId: target._id,
    targetUserId: target._id,
  });
  notifyLater(target._id, {
    type: "moderatorRemoved",
    actorId: user.userId,
    authorId: user.userId,
  });
  refresh();
  return { ok: true };
}

// Who may decide an open report: the author or a moderator of its community, the admin for
// the rest (D80). A moderator does not decide a report about themselves or another moderator,
// as with canModerate. Anyone else gets NOT_FOUND.
async function mayDecide(
  userId: string,
  report: {
    route: "author" | "admin";
    authorId?: Types.ObjectId;
    targetUserId: Types.ObjectId;
  },
): Promise<boolean> {
  if (report.route === "author") {
    const authorId = report.authorId!.toString();
    const role = await moderationRole(userId, authorId);
    if (role !== "moderator") return role !== null;
    return (
      !report.targetUserId.equals(userId) &&
      !(await isModeratorOf(report.targetUserId.toString(), authorId))
    );
  }
  const user = await User.findById(userId)
    .select({ role: 1, globalBan: 1 })
    .lean();
  return isAdmin(user) && !isBanActive(user!.globalBan, new Date());
}

export async function resolveReport(
  id: string,
  outcome: ReportOutcome,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isId(id) || !REPORT_OUTCOMES.includes(outcome)) return invalid();
  const limited = await limitError(user.userId);
  if (limited) return limited;
  const reportNotFound = () => actionError("NOT_FOUND", "reportNotFound");
  const report = await Report.findOne({ _id: id, state: "open" })
    .select({ route: 1, authorId: 1, targetUserId: 1, reporterId: 1 })
    .lean();
  if (!report || !(await mayDecide(user.userId, report))) {
    return reportNotFound();
  }

  const { modifiedCount } = await Report.updateOne(
    { _id: report._id, state: "open" },
    {
      $set: { state: outcome, resolvedBy: user.userId, resolvedAt: new Date() },
    },
  );
  if (modifiedCount === 0) return reportNotFound();
  await logModeration({
    ...(report.route === "author"
      ? { authorId: report.authorId! }
      : { authorId: null, scope: "global" as const }),
    actorId: user.userId,
    action: outcome === "resolved" ? "resolve" : "dismiss",
    targetType: "report",
    targetId: report._id,
    targetUserId: report.targetUserId,
  });
  notifyLater(report.reporterId, {
    type: outcome === "resolved" ? "reportResolved" : "reportDismissed",
    actorId: user.userId,
    ...(report.authorId && { authorId: report.authorId }),
  });
  refresh();
  return { ok: true };
}
