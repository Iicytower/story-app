"use server";

import type { Types } from "mongoose";
import { refresh } from "next/cache";
import { isString } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { classifyCover } from "@/lib/covers/classify";
import {
  AVATAR_SIZE,
  coverAdultThreshold,
  coversMaxTotalBytes,
  isAdultScores,
  validateUpload,
} from "@/lib/covers/covers";
import { storedImageBytes } from "@/lib/covers/queries";
import { connectDB, isDuplicateKeyError } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { lengthError } from "@/lib/limits";
import { Avatar } from "@/lib/models/avatar";
import { Profile, type ProfileFields } from "@/lib/models/profile";
import { User } from "@/lib/models/user";
import { avatarPath } from "@/lib/profiles/queries";
import { SOCIAL_LIMITS, takeUserAttempt } from "@/lib/rate-limit";
import { toolsConfig } from "@/lib/tools/client";

// The first save of a profile inserts it; two at once (two tabs) can both try.
async function upsertProfile(
  userId: string,
  update: Record<string, unknown>,
): Promise<Pick<ProfileFields, "avatarId"> | null> {
  const run = () =>
    Profile.findOneAndUpdate({ userId }, update, {
      upsert: true,
      projection: { avatarId: 1 },
    }).lean();
  try {
    return await run();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return run();
  }
}

export async function getMyProfile(): Promise<
  ActionResult<{ nickname: string | null; bio: string; avatar: string | null }>
> {
  const user = await requireUser();
  if (!user.ok) return user;
  await connectDB();
  const [account, profile] = await Promise.all([
    User.findById(user.userId).select({ nickname: 1 }).lean(),
    Profile.findOne({ userId: user.userId })
      .select({ bio: 1, avatarId: 1 })
      .lean(),
  ]);
  return {
    ok: true,
    nickname: account?.nickname ?? null,
    bio: profile?.bio ?? "",
    avatar: profile?.avatarId ? avatarPath(profile.avatarId.toString()) : null,
  };
}

export async function updateBio(
  bio: string,
): Promise<ActionResult<{ bio: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isString(bio)) return actionError("INVALID_INPUT", "requestInvalid");
  const value = bio.trim();
  const tooLong = lengthError("bio", value);
  if (tooLong) return translateError(tooLong);
  await connectDB();
  await upsertProfile(user.userId, { $set: { bio: value } });

  refresh();
  return { ok: true, bio: value };
}

// Synchronous, unlike covers (D80): no verdict means no avatar, and an 18+ one is refused.
export async function uploadAvatar(
  form: FormData,
): Promise<ActionResult<{ avatar: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config) return actionError("TOOL_UNAVAILABLE", "avatarsUnavailable");
  if (!(form instanceof FormData)) {
    return actionError("INVALID_INPUT", "avatarInvalid");
  }
  const file = form.get("avatar");
  if (!(file instanceof Blob)) {
    return actionError("INVALID_INPUT", "avatarInvalid");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = validateUpload(bytes);
  if (!valid.ok) {
    return valid.error === "TOO_LARGE"
      ? actionError("TOO_LARGE", "avatarTooLarge")
      : actionError("INVALID_INPUT", "avatarInvalid");
  }

  await connectDB();
  // A replacement frees the old avatar's room, as with covers (D68).
  const replacing = await Profile.exists({
    userId: user.userId,
    avatarId: { $exists: true },
  });
  if (
    !replacing &&
    (await storedImageBytes()) + bytes.length > coversMaxTotalBytes()
  ) {
    return actionError("TOO_LARGE", "avatarLimitTotal");
  }
  if (!(await takeUserAttempt(SOCIAL_LIMITS.avatarDay, user.userId))) {
    return actionError("RATE_LIMITED", "tooManyAttempts");
  }

  let classification;
  try {
    classification = await classifyCover(config, bytes, AVATAR_SIZE);
  } catch {
    return actionError("TOOL_UNAVAILABLE", "toolUnavailable");
  }
  if (isAdultScores(classification.scores, coverAdultThreshold())) {
    return actionError("INVALID_INPUT", "avatarAdult");
  }

  const avatar = await Avatar.create({
    userId: user.userId,
    data: classification.image,
    size: classification.image.length,
    scores: classification.scores,
    model: classification.model,
  });
  let before;
  try {
    before = await upsertProfile(user.userId, {
      $set: { avatarId: avatar._id },
    });
  } catch {
    await removeAvatarImage(user.userId, avatar._id);
    return actionError("CONFLICT", "requestInvalid");
  }
  await removeAvatarImage(user.userId, before?.avatarId);

  refresh();
  return { ok: true, avatar: avatarPath(avatar._id.toString()) };
}

async function removeAvatarImage(userId: string, id?: Types.ObjectId) {
  if (id) await Avatar.deleteOne({ _id: id, userId });
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  await connectDB();
  const before = await Profile.findOneAndUpdate(
    { userId: user.userId },
    { $unset: { avatarId: 1 } },
    { projection: { avatarId: 1 } },
  ).lean();
  await removeAvatarImage(user.userId, before?.avatarId);

  refresh();
  return { ok: true };
}
