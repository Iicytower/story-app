"use server";

import type { Types } from "mongoose";
import { isId, isString } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { lengthError } from "@/lib/limits";
import { Report } from "@/lib/models/report";
import { NICKNAME_COLLATION, User } from "@/lib/models/user";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { isAuthorVisibleTo } from "@/lib/social/permissions";
import {
  isReportReason,
  type ReportReason,
  type ReportTarget,
} from "@/lib/social/reports";
import {
  findVisibleComment,
  findVisibleFolder,
  findVisibleStory,
} from "@/lib/social/visibility";

const invalid = () => actionError("INVALID_INPUT", "requestInvalid");
const notFound = () => actionError("NOT_FOUND", "reportTargetNotFound");

interface Target {
  id: Types.ObjectId;
  // Whose content it is.
  userId: Types.ObjectId;
  // The community a comment is in, unless the author wrote it (D80: the author's content goes
  // to the admin).
  authorId: Types.ObjectId | null;
}

// Only what the reporter sees (D38, D80): a hidden comment or a book of a blocked author is not
// there to report.
async function findTarget(
  userId: string,
  targetType: Exclude<ReportTarget, "post">,
  target: string,
): Promise<Target | null> {
  switch (targetType) {
    case "comment": {
      const comment = await findVisibleComment(userId, target);
      if (!comment) return null;
      return {
        id: comment._id,
        userId: comment.writerId,
        authorId: comment.writerId.equals(comment.authorId)
          ? null
          : comment.authorId,
      };
    }
    case "story": {
      const story = await findVisibleStory(userId, target);
      return story && { id: story._id, userId: story.userId, authorId: null };
    }
    case "folder": {
      const folder = await findVisibleFolder(userId, target);
      return (
        folder && { id: folder._id, userId: folder.userId, authorId: null }
      );
    }
    case "profile": {
      await connectDB();
      const user = await User.findOne({ nickname: target })
        .collation(NICKNAME_COLLATION)
        .select({ _id: 1 })
        .lean();
      // A globally banned account's profile is a 404 for others (task 70); an account the
      // reporter blocked is hidden from them, as its books are.
      if (!user || !(await isAuthorVisibleTo(userId, user._id))) return null;
      return { id: user._id, userId: user._id, authorId: null };
    }
  }
}

// A profile is reported by its nickname, the rest by id. Neither a block nor a ban stops a
// report (D80): canInteract does not apply.
export async function report(
  targetType: ReportTarget,
  target: string,
  reason: ReportReason,
  details: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  // Forum posts join in task 87.
  if (
    (targetType !== "comment" &&
      targetType !== "story" &&
      targetType !== "folder" &&
      targetType !== "profile") ||
    !(targetType === "profile" ? isString(target) : isId(target)) ||
    !isReportReason(reason) ||
    !isString(details)
  ) {
    return invalid();
  }
  const text = details.trim();
  const tooLong = lengthError("report", text);
  if (tooLong) return translateError(tooLong);
  if (!(await takeUserAttempt(SOCIAL_LIMITS.reportDay, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }
  const found = await findTarget(user.userId, targetType, target);
  if (!found) return notFound();
  if (found.userId.equals(user.userId)) {
    return actionError("FORBIDDEN", "interactionNotAllowed");
  }

  try {
    await Report.create({
      reporterId: user.userId,
      targetType,
      targetId: found.id,
      targetUserId: found.userId,
      ...(found.authorId
        ? { route: "author", authorId: found.authorId }
        : { route: "admin" }),
      reason,
      details: text,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return actionError("INVALID_INPUT", "reportAlreadyOpen");
  }
  // Task 81: notify the author and the community's moderators, or the admins (route admin).
  return { ok: true };
}
