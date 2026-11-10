"use server";

import { Types } from "mongoose";
import { refresh } from "next/cache";
import { isBoolean, isId } from "@/lib/action-input";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import {
  COVERS_PER_ACCOUNT,
  coversMaxTotalBytes,
  validateUpload,
} from "@/lib/covers/covers";
import {
  CLAIM_LEASE_MS,
  rateCover,
  removeCovers,
} from "@/lib/covers/mutations";
import { storedImageBytes } from "@/lib/covers/queries";
import { connectDB } from "@/lib/db";
import { actionError, translateError } from "@/lib/i18n/action-error";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { toolsConfig } from "@/lib/tools/client";

const NOT_FOUND = () => actionError("NOT_FOUND", "folderNotFound");

async function ownedFolder(userId: string, id: string) {
  if (!isId(id)) return null;
  await connectDB();
  return Folder.findOne({ _id: id, userId, deletedAt: null })
    .select({ coverId: 1 })
    .lean();
}

// A replacement passes both limits: it frees the old cover's room once rated (D68).
async function exceedsLimits(
  userId: string,
  folderId: Types.ObjectId,
  size: number,
) {
  const [otherFolders, total] = await Promise.all([
    Cover.distinct("folderId", { userId, folderId: { $ne: folderId } }),
    storedImageBytes(),
  ]);
  if (otherFolders.length >= COVERS_PER_ACCOUNT) {
    return actionError("TOO_LARGE", "coverLimitAccount", {
      max: COVERS_PER_ACCOUNT,
    });
  }
  if (total + size > coversMaxTotalBytes()) {
    return actionError("TOO_LARGE", "coverLimitTotal");
  }
  return null;
}

export async function setFolderCover(
  id: string,
  form: FormData,
): Promise<ActionResult<{ state: "rated" | "pending"; adult: boolean }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const config = toolsConfig();
  if (!config) return actionError("TOOL_UNAVAILABLE", "coversUnavailable");
  const folder = await ownedFolder(user.userId, id);
  if (!folder) return NOT_FOUND();

  if (!(form instanceof FormData)) {
    return actionError("INVALID_INPUT", "coverInvalid");
  }
  const file = form.get("cover");
  if (!(file instanceof Blob)) {
    return actionError("INVALID_INPUT", "coverInvalid");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = validateUpload(bytes);
  if (!valid.ok) return translateError(valid);

  const replacing =
    Boolean(folder.coverId) ||
    Boolean(await Cover.exists({ folderId: folder._id }));
  if (!replacing) {
    const limit = await exceedsLimits(user.userId, folder._id, bytes.length);
    if (limit) return limit;
  }

  // Only the newest upload waits for a verdict.
  await Cover.deleteMany({ folderId: folder._id, state: "pending" });
  const cover = await Cover.create({
    userId: user.userId,
    folderId: folder._id,
    data: bytes,
    size: bytes.length,
    state: "pending",
    attempts: 0,
    // Claimed by this request, so a retry cannot start while the first try runs.
    nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS),
  });
  await Folder.updateOne(
    { _id: folder._id },
    { $unset: { coverRejectedAt: 1 } },
    { timestamps: false },
  );
  const result = await rateCover(config, cover.toObject());
  const rated =
    result === "rated" &&
    (await Cover.findById(cover._id).select({ autoAdult: 1 }).lean());

  refresh();
  return rated
    ? { ok: true, state: "rated", adult: Boolean(rated.autoAdult) }
    : { ok: true, state: "pending", adult: false };
}

export async function removeFolderCover(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const folder = await ownedFolder(user.userId, id);
  if (!folder) return NOT_FOUND();
  await removeCovers(folder._id);

  refresh();
  return { ok: true };
}

// The owner's own mark on the cover; unlike the filter's, it does not lock the folder.
export async function setCoverAdult(
  id: string,
  adult: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (!isBoolean(adult)) {
    return actionError("INVALID_INPUT", "requestInvalid");
  }
  const folder = await ownedFolder(user.userId, id);
  if (!folder) return NOT_FOUND();
  if (!folder.coverId) return actionError("NOT_FOUND", "coverNotFound");
  await Cover.updateOne(
    { _id: folder.coverId, folderId: folder._id },
    { $set: { manualAdult: adult } },
  );

  refresh();
  return { ok: true };
}

export async function dismissCoverRejection(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user.ok) return user;
  const folder = await ownedFolder(user.userId, id);
  if (!folder) return NOT_FOUND();
  await Folder.updateOne(
    { _id: folder._id },
    { $unset: { coverRejectedAt: 1 } },
    { timestamps: false },
  );

  refresh();
  return { ok: true };
}
