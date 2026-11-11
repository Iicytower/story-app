"use server";

import type { Types } from "mongoose";
import { refresh } from "next/cache";
import { isBoolean, isId, isString } from "@/lib/action-input";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { actionError, translateError } from "@/lib/i18n/action-error";
import {
  lengthError,
  MAX_CATEGORY_LABEL_LENGTH,
  MAX_MODERATORS,
} from "@/lib/limits";
import { syncFolderAdultWithCover } from "@/lib/covers/mutations";
import { Comment } from "@/lib/models/comment";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { ForumCategory } from "@/lib/models/forum-category";
import { ForumThread } from "@/lib/models/forum-thread";
import type { ModerationAction } from "@/lib/models/moderation-log";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import {
  findAdultTarget,
  findUserByNick,
  isActiveAdmin,
} from "@/lib/social/admin";
import { applyCommentHide } from "@/lib/social/comment-moderation";
import {
  applyForumHide,
  findForumContent,
} from "@/lib/social/forum-moderation";
import { logModeration } from "@/lib/social/moderation";
import { isAdmin, isBanActive } from "@/lib/social/permissions";
import { removePredefinedTag, savePredefinedTag } from "@/lib/tags/mutations";
import { normalizeTag } from "@/lib/tags/tags";
import type { BanDuration } from "../moderation/actions";

const DAY_MS = 24 * 60 * 60 * 1000;
const DURATIONS: readonly unknown[] = [1, 7, 30, null];
// The thread address /forums/t/<id> (task 87).
const RESERVED_CATEGORY_KEYS = new Set(["t"]);

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const userNotFound = () => actionError("NOT_FOUND", "userNotFound");
const categoryNotFound = () => actionError("NOT_FOUND", "categoryNotFound");
const cannotModerate = () => actionError("FORBIDDEN", "cannotModerate");
const GLOBAL = { authorId: null, scope: "global" as const };

// First in every admin action: NOT_FOUND for anyone else whatever the input, as the page is a
// 404 (task 88), then the moderation limit.
async function adminError(userId: string): Promise<ActionError | null> {
  if (!(await isActiveAdmin(userId))) {
    return actionError("NOT_FOUND", "adminNotFound");
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.moderate, userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  return null;
}

export async function setGlobalBan(
  nickname: string,
  duration: BanDuration,
  reason: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (
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
  const target = await findUserByNick(nickname);
  if (!target) return userNotFound();
  // An admin is never banned by another admin (task 88).
  if (target._id.equals(user.userId) || isAdmin(target)) {
    return cannotModerate();
  }

  const now = new Date();
  const until =
    duration === null ? null : new Date(now.getTime() + duration * DAY_MS);
  await User.updateOne(
    { _id: target._id },
    { $set: { globalBan: { until, reason: text, by: user.userId, at: now } } },
  );
  await logModeration({
    ...GLOBAL,
    actorId: user.userId,
    action: "ban",
    targetType: "user",
    targetId: target._id,
    targetUserId: target._id,
    reason: text,
  });
  refresh();
  return { ok: true };
}

export async function liftGlobalBan(nickname: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(nickname)) return invalid();
  const target = await findUserByNick(nickname);
  if (!target) return userNotFound();
  if (!isBanActive(target.globalBan, new Date())) {
    return actionError("NOT_FOUND", "banNotFound");
  }
  await User.updateOne({ _id: target._id }, { $unset: { globalBan: 1 } });
  await logModeration({
    ...GLOBAL,
    actorId: user.userId,
    action: "unban",
    targetType: "user",
    targetId: target._id,
    targetUserId: target._id,
  });
  refresh();
  return { ok: true };
}

const ADULT_ACTION: Record<string, ModerationAction> = {
  true: "markAdult",
  false: "unmarkAdult",
  null: "clearAdult",
};

// true locks the owner's mark, false lifts it over the filter and the owner, null takes the
// admin's mark back (D80). Organizational, like the owner's mark: no timestamps (D67).
export async function setAdminAdult(
  address: string,
  value: boolean | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(address) || (value !== null && !isBoolean(value))) {
    return invalid();
  }
  const target = await findAdultTarget(address);
  if (!target) return actionError("NOT_FOUND", "adultTargetNotFound");

  const quiet = { timestamps: false } as const;
  const field = target.type === "cover" ? "adminAdult" : "adult.admin";
  const update =
    value === null ? { $unset: { [field]: 1 } } : { $set: { [field]: value } };
  const owner =
    target.type === "cover"
      ? await Cover.findOneAndUpdate({ _id: target.id }, update, {
          ...quiet,
          projection: { userId: 1 },
        }).lean()
      : target.type === "folder"
        ? await Folder.findOneAndUpdate({ _id: target.id }, update, {
            ...quiet,
            projection: { userId: 1 },
          }).lean()
        : await Story.findOneAndUpdate({ _id: target.id }, update, {
            ...quiet,
            projection: { userId: 1 },
          }).lean();
  if (!owner) return actionError("NOT_FOUND", "adultTargetNotFound");
  // The folder's 18+ lock follows the cover's verdict, the admin's like the filter's.
  if (target.type === "cover") await syncFolderAdultWithCover(owner._id);
  await logModeration({
    ...GLOBAL,
    actorId: user.userId,
    action: ADULT_ACTION[String(value)],
    targetType: target.type,
    targetId: owner._id,
    targetUserId: owner.userId,
  });
  refresh();
  return { ok: true };
}

// From the report queue (task 88): comments and forum posts anywhere, logged for the whole site.
export async function adminHide(
  targetType: "comment" | "post",
  id: string,
  reason?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if ((targetType !== "comment" && targetType !== "post") || !isId(id)) {
    return invalid();
  }
  if (reason !== undefined && !isString(reason)) return invalid();
  const text = reason?.trim() || undefined;
  const tooLong = text && lengthError("hideReason", text);
  if (tooLong) return translateError(tooLong);

  if (targetType === "post") {
    const post = await findForumContent(null, "post", id, true);
    if (!post) return actionError("NOT_FOUND", "postNotFound");
    if (post.writerId.equals(user.userId)) return cannotModerate();
    const result = await applyForumHide(
      user.userId,
      "post",
      post,
      text,
      GLOBAL,
    );
    if (result.ok) refresh();
    return result;
  }
  const comment = await Comment.findOne({ _id: id, deletedAt: null })
    .select({ authorId: 1, userId: 1, hidden: 1, folderId: 1, storyId: 1 })
    .lean();
  if (!comment) return actionError("NOT_FOUND", "commentNotFound");
  if (comment.userId.equals(user.userId)) return cannotModerate();
  await applyCommentHide(user.userId, comment, text, GLOBAL);
  refresh();
  return { ok: true };
}

// The English label normalized like a tag key (D79), with dashes for the address.
function categoryKey(label: string): string {
  return normalizeTag(label).replace(/[\s/?#%\\]+/g, "-");
}

async function labelsError(labels: unknown): Promise<ActionError | null> {
  const { en, pl } = (labels ?? {}) as { en?: unknown; pl?: unknown };
  if (!isString(en) || !isString(pl)) return invalid();
  if (!en.trim() || !pl.trim()) {
    return actionError("INVALID_INPUT", "categoryLabelRequired");
  }
  if (
    en.trim().length > MAX_CATEGORY_LABEL_LENGTH ||
    pl.trim().length > MAX_CATEGORY_LABEL_LENGTH
  ) {
    return actionError("INVALID_INPUT", "categoryLabelTooLong", {
      max: MAX_CATEGORY_LABEL_LENGTH,
    });
  }
  return null;
}

async function logCategory(
  actorId: string,
  action: ModerationAction,
  key: string,
  targetUserId?: Types.ObjectId,
) {
  await logModeration({
    ...GLOBAL,
    actorId,
    action,
    targetType: "category",
    targetKey: key,
    ...(targetUserId && { targetUserId }),
  });
}

// A new category when key is null; its key comes from the English label (task 88).
export async function saveCategory(
  key: string | null,
  labels: { en: string; pl: string },
  adminOnly: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if ((key !== null && !isString(key)) || !isBoolean(adminOnly)) {
    return invalid();
  }
  const labelError = await labelsError(labels);
  if (labelError) return labelError;
  const trimmed = { en: labels.en.trim(), pl: labels.pl.trim() };

  if (key !== null) {
    const { matchedCount } = await ForumCategory.updateOne(
      { _id: key },
      adminOnly
        ? { $set: { labels: trimmed, adminOnly: true } }
        : { $set: { labels: trimmed }, $unset: { adminOnly: 1 } },
    );
    if (matchedCount === 0) return categoryNotFound();
    await logCategory(user.userId, "save", key);
    refresh();
    return { ok: true };
  }
  const newKey = categoryKey(trimmed.en);
  // Dots alone are no address; a deleted category's threads would come back under its key.
  if (
    /^[.-]*$/.test(newKey) ||
    RESERVED_CATEGORY_KEYS.has(newKey) ||
    (await ForumCategory.exists({ _id: newKey })) ||
    (await ForumThread.exists({ categoryId: newKey }))
  ) {
    return actionError("INVALID_INPUT", "categoryKeyTaken");
  }
  const last = await ForumCategory.findOne()
    .sort({ order: -1 })
    .select({ order: 1 })
    .lean();
  try {
    await ForumCategory.create({
      _id: newKey,
      labels: trimmed,
      order: (last?.order ?? -1) + 1,
      ...(adminOnly && { adminOnly: true }),
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return actionError("INVALID_INPUT", "categoryKeyTaken");
  }
  await logCategory(user.userId, "save", newKey);
  refresh();
  return { ok: true };
}

// One place up or down; the orders are renumbered, so equal ones never get stuck.
export async function moveCategory(
  key: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key) || (direction !== "up" && direction !== "down")) {
    return invalid();
  }
  const categories = await ForumCategory.find()
    .sort({ order: 1, _id: 1 })
    .select({ _id: 1 })
    .lean();
  const keys = categories.map(({ _id }) => _id);
  const index = keys.indexOf(key);
  if (index === -1) return categoryNotFound();
  const other = direction === "up" ? index - 1 : index + 1;
  if (other < 0 || other >= keys.length) return { ok: true };
  [keys[index], keys[other]] = [keys[other], keys[index]];
  await ForumCategory.bulkWrite(
    keys.map((_id, order) => ({
      updateOne: { filter: { _id }, update: { $set: { order } } },
    })),
  );
  await logCategory(user.userId, "move", key);
  refresh();
  return { ok: true };
}

// Its threads stay in the database, hidden with the category (D80).
export async function deleteCategory(key: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key)) return invalid();
  const { deletedCount } = await ForumCategory.deleteOne({ _id: key });
  if (deletedCount === 0) return categoryNotFound();
  await logCategory(user.userId, "delete", key);
  refresh();
  return { ok: true };
}

export async function addCategoryModerator(
  key: string,
  nickname: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key) || !isString(nickname)) return invalid();
  const target = await findUserByNick(nickname);
  if (!target || isBanActive(target.globalBan, new Date())) {
    return userNotFound();
  }
  const category = await ForumCategory.findById(key)
    .select({ moderatorIds: 1 })
    .lean();
  if (!category) return categoryNotFound();
  if (category.moderatorIds.some((id) => id.equals(target._id))) {
    return { ok: true };
  }
  // The limit in the filter, so two additions at once cannot pass it.
  const { modifiedCount } = await ForumCategory.updateOne(
    { _id: key, [`moderatorIds.${MAX_MODERATORS - 1}`]: { $exists: false } },
    { $addToSet: { moderatorIds: target._id } },
  );
  if (modifiedCount === 0) {
    return actionError("INVALID_INPUT", "tooManyModerators", {
      max: MAX_MODERATORS,
    });
  }
  await logCategory(user.userId, "addModerator", key, target._id);
  refresh();
  return { ok: true };
}

export async function removeCategoryModerator(
  key: string,
  nickname: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key) || !isString(nickname)) return invalid();
  const target = await findUserByNick(nickname);
  if (!target) return userNotFound();
  const { matchedCount, modifiedCount } = await ForumCategory.updateOne(
    { _id: key },
    { $pull: { moderatorIds: target._id } },
  );
  if (matchedCount === 0) return categoryNotFound();
  if (modifiedCount === 0) return actionError("NOT_FOUND", "moderatorNotFound");
  await logCategory(user.userId, "removeModerator", key, target._id);
  refresh();
  return { ok: true };
}

// The same check and write as npm run tags (D79).
export async function saveTag(
  key: string,
  en: string,
  pl: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key) || !isString(en) || !isString(pl)) return invalid();
  const error = await savePredefinedTag({ key, labels: { en, pl } });
  if (error)
    return translateError({ ok: false, error: "INVALID_INPUT", ...error });
  await logModeration({
    ...GLOBAL,
    actorId: user.userId,
    action: "save",
    targetType: "tag",
    targetKey: key,
  });
  refresh();
  return { ok: true };
}

export async function removeTag(key: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const denied = await adminError(user.userId);
  if (denied) return denied;
  if (!isString(key)) return invalid();
  if (!(await removePredefinedTag(key))) {
    return actionError("NOT_FOUND", "tagNotFound");
  }
  await logModeration({
    ...GLOBAL,
    actorId: user.userId,
    action: "delete",
    targetType: "tag",
    targetKey: key,
  });
  refresh();
  return { ok: true };
}
