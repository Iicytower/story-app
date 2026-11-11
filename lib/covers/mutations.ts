import { mongo, type Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Cover } from "@/lib/models/cover";
import { Folder } from "@/lib/models/folder";
import { toolsConfig, type ToolsConfig } from "@/lib/tools/client";
import { classifyCover } from "./classify";
import { coverAdultThreshold, isAdultScores, nextAttemptAt } from "./covers";

type Id = string | Types.ObjectId;

// lean() and toObject() give a Buffer path as a BSON Binary.
export function coverBytes(data: Buffer | mongo.Binary): Buffer {
  return data instanceof mongo.Binary ? Buffer.from(data.buffer) : data;
}

// Keeps a claimed cover from being tried twice at once; a crashed try is picked up after it.
const CLAIM_LEASE_MS = 2 * 60_000;
const RETRIES_PER_REQUEST = 3;

export type RatingResult = "rated" | "pending" | "rejected" | "gone";

// Cover changes are organizational, like 18+ marks: no updatedAt or lastActivityAt (D68).
const quiet = { timestamps: false } as const;

async function applyRating(
  coverId: Types.ObjectId,
  folderId: Types.ObjectId,
  update: {
    image: Buffer;
    scores: { nsfl: number; nsfw: number; sfw: number };
    model: string;
  },
): Promise<RatingResult> {
  const autoAdult = isAdultScores(update.scores, coverAdultThreshold());
  const rated = await Cover.findOneAndUpdate(
    { _id: coverId, state: "pending" },
    {
      $set: {
        state: "rated",
        data: update.image,
        size: update.image.length,
        scores: update.scores,
        model: update.model,
        autoAdult,
      },
      $unset: { nextAttemptAt: 1 },
    },
  ).lean();
  // Replaced by a newer upload or removed meanwhile.
  if (!rated) return "gone";
  const before = await Folder.findOneAndUpdate(
    { _id: folderId, deletedAt: null },
    {
      $set: { coverId, "adult.auto": autoAdult },
      $unset: { coverRejectedAt: 1 },
    },
    { ...quiet, projection: { coverId: 1 } },
  ).lean();
  if (!before) {
    await Cover.deleteOne({ _id: coverId });
    return "gone";
  }
  if (before.coverId && !before.coverId.equals(coverId)) {
    await Cover.deleteOne({ _id: before.coverId });
  }
  return "rated";
}

async function recordFailure(
  coverId: Types.ObjectId,
  folderId: Types.ObjectId,
  uploadedAt: Date,
  attempts: number,
): Promise<RatingResult> {
  const failed = attempts + 1;
  const next = nextAttemptAt(uploadedAt, failed);
  if (next) {
    await Cover.updateOne(
      { _id: coverId, state: "pending" },
      { $set: { attempts: failed, nextAttemptAt: next } },
    );
    return "pending";
  }
  const { deletedCount } = await Cover.deleteOne({
    _id: coverId,
    state: "pending",
  });
  if (deletedCount === 0) return "gone";
  await Folder.updateOne(
    { _id: folderId, deletedAt: null },
    { $set: { coverRejectedAt: new Date() } },
    quiet,
  );
  return "rejected";
}

// One try for a pending cover the caller owns (fresh upload or a claim).
export async function rateCover(
  config: ToolsConfig,
  cover: {
    _id: Types.ObjectId;
    folderId: Types.ObjectId;
    data: Buffer | mongo.Binary;
    attempts: number;
    createdAt: Date;
  },
): Promise<RatingResult> {
  let classification;
  try {
    classification = await classifyCover(config, coverBytes(cover.data));
  } catch {
    return recordFailure(
      cover._id,
      cover.folderId,
      cover.createdAt,
      cover.attempts,
    );
  }
  return applyRating(cover._id, cover.folderId, classification);
}

// Called after responses of pages that read folders (D68: no background jobs on Vercel Hobby).
export async function retryDueCovers(
  limit = RETRIES_PER_REQUEST,
): Promise<RatingResult[]> {
  const config = toolsConfig();
  if (!config) return [];
  await connectDB();
  const results: RatingResult[] = [];
  for (let index = 0; index < limit; index++) {
    const now = new Date();
    const cover = await Cover.findOneAndUpdate(
      { state: "pending", nextAttemptAt: { $lte: now } },
      { $set: { nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) } },
      { sort: { nextAttemptAt: 1 } },
    ).lean();
    if (!cover) break;
    results.push(await rateCover(config, cover));
  }
  return results;
}

// The folder's lock follows the cover as the filter set it, unless the admin decided (task 88);
// the owner's own mark on the cover does not lock the folder (D68).
export async function syncFolderAdultWithCover(coverId: Id): Promise<void> {
  const cover = await Cover.findById(coverId)
    .select({ folderId: 1, autoAdult: 1, adminAdult: 1 })
    .lean();
  if (!cover) return;
  await Folder.updateOne(
    { _id: cover.folderId, coverId: cover._id },
    { $set: { "adult.auto": cover.adminAdult ?? Boolean(cover.autoAdult) } },
    quiet,
  );
}

// Removes the folder's cover and any pending one; the filter's 18+ lock goes with them.
export async function removeCovers(folderId: Id): Promise<void> {
  await Cover.deleteMany({ folderId });
  await Folder.updateOne(
    { _id: folderId },
    { $unset: { coverId: 1 }, $set: { "adult.auto": false } },
    quiet,
  );
}

export { CLAIM_LEASE_MS };
