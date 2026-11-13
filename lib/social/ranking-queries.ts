import { Types } from "mongoose";
import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Ranking, type RankingItem } from "@/lib/models/ranking";
import { Rating } from "@/lib/models/rating";
import { ReadEvent } from "@/lib/models/read-event";
import { findPublicBooks, type PublicBook } from "@/lib/publish/queries";
import { feedHiddenUserIds } from "@/lib/social/feed";
import { hiddenUserIdsFor } from "@/lib/social/permissions";
import {
  isRankingStale,
  RANKING_LEASE_MS,
  RANKING_MAX_AGE_MS,
  RANKING_SHOWN,
  RANKING_STORED,
  RANKING_WEEK_DAYS,
  rankByScore,
  rankTopRated,
  type ScoredBook,
} from "@/lib/social/rankings";
import { statsDay } from "@/lib/social/read-stats";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ComputedRanking = "weekly" | "topRated";
const COMPUTED: ComputedRanking[] = ["weekly", "topRated"];

// D68: the claim is a lease, so a computation that died is taken over once it ends. The first
// upsert matches the unique _id exactly, so parallel ones do not fail on a duplicate key.
async function claim(key: ComputedRanking, now: Date): Promise<Date | null> {
  await Ranking.updateOne(
    { _id: key },
    { $setOnInsert: { items: [], computedAt: new Date(0), computing: null } },
    { upsert: true },
  );
  const lease = new Date(now.getTime() + RANKING_LEASE_MS);
  const claimed = await Ranking.findOneAndUpdate(
    {
      _id: key,
      computedAt: { $lte: new Date(now.getTime() - RANKING_MAX_AGE_MS) },
      $or: [{ computing: null }, { computing: { $lte: now } }],
    },
    { $set: { computing: lease } },
  ).lean();
  return claimed ? lease : null;
}

// Books that may still be ranked: published and active, by an author without a global ban. The
// rest of D38 and the viewer's blocks are checked when the ranking is read.
async function rankableFolders(
  ids: Types.ObjectId[],
  banned: Types.ObjectId[],
) {
  return Folder.find({
    _id: { $in: ids },
    userId: { $nin: banned },
    published: true,
    deletedAt: null,
  })
    .select({ _id: 1 })
    .lean();
}

const toItems = (books: ScoredBook[]): RankingItem[] =>
  books.slice(0, RANKING_STORED).map(({ folderId, score }) => ({
    folderId: new Types.ObjectId(folderId),
    score,
  }));

// Unique readers of each book over the last 7 days; globally banned accounts are not counted
// (guests cannot be told apart, so they all count).
async function computeWeekly(now: Date, banned: Types.ObjectId[]) {
  const since = statsDay(
    new Date(now.getTime() - (RANKING_WEEK_DAYS - 1) * DAY_MS),
  );
  const counts = await ReadEvent.aggregate<{
    _id: Types.ObjectId;
    readers: number;
  }>([
    {
      $match: {
        day: { $gte: since },
        reader: { $nin: banned.map((id) => `u:${id}`) },
      },
    },
    { $group: { _id: { folderId: "$folderId", reader: "$reader" } } },
    { $group: { _id: "$_id.folderId", readers: { $sum: 1 } } },
  ]);
  const folders = await rankableFolders(
    counts.map(({ _id }) => _id),
    banned,
  );
  const rankable = new Set(folders.map(({ _id }) => _id.toString()));
  return toItems(
    rankByScore(
      counts
        .filter(({ _id }) => rankable.has(_id.toString()))
        .map(({ _id, readers }) => ({
          folderId: _id.toString(),
          score: readers,
        })),
    ),
  );
}

// Book ratings only, with the same filter as the counters on the page (task 78).
async function computeTopRated(banned: Types.ObjectId[]) {
  const totals = await Rating.aggregate<{
    _id: Types.ObjectId;
    count: number;
    sum: number;
  }>([
    { $match: { targetType: "folder", userId: { $nin: banned } } },
    {
      $group: { _id: "$targetId", count: { $sum: 1 }, sum: { $sum: "$value" } },
    },
  ]);
  const ranked = rankTopRated(
    totals.map(({ _id, count, sum }) => ({
      folderId: _id.toString(),
      count,
      sum,
    })),
  );
  const folders = await rankableFolders(
    ranked.map(({ folderId }) => new Types.ObjectId(folderId)),
    banned,
  );
  const rankable = new Set(folders.map(({ _id }) => _id.toString()));
  return toItems(ranked.filter(({ folderId }) => rankable.has(folderId)));
}

// Recomputes a ranking older than an hour that nobody else is computing; true when it did.
export async function recomputeRanking(key: ComputedRanking): Promise<boolean> {
  await connectDB();
  const now = new Date();
  const lease = await claim(key, now);
  if (!lease) return false;
  // Global bans are read once per computation, not on every render.
  const banned = await hiddenUserIdsFor(null);
  const finish = (items: RankingItem[]) =>
    Ranking.updateOne(
      { _id: key, computing: lease },
      { $set: { items, computedAt: now, computing: null } },
    );
  if (key === "topRated") {
    return (await finish(await computeTopRated(banned))).modifiedCount === 1;
  }
  return (await finish(await computeWeekly(now, banned))).modifiedCount === 1;
}

export async function recomputeStaleRankings(): Promise<void> {
  await Promise.all(COMPUTED.map(recomputeRanking));
}

export interface HomeRankings {
  weekly: PublicBook[];
  topRated: PublicBook[];
}

// Stored rankings filtered for the viewer: D38, global bans and blocks both ways (as the feed).
// A stale ranking is shown as it is and recomputed after the response.
export async function getHomeRankings(
  viewerId: string | null,
): Promise<HomeRankings> {
  await connectDB();
  const now = new Date();
  const [docs, hidden] = await Promise.all([
    Ranking.find({ _id: { $in: COMPUTED } })
      .select({ items: 1, computedAt: 1, computing: 1 })
      .lean(),
    viewerId ? feedHiddenUserIds(viewerId) : hiddenUserIdsFor(null),
  ]);
  const byKey = new Map(docs.map((doc) => [doc._id, doc]));
  if (
    COMPUTED.some((key) => {
      const doc = byKey.get(key);
      if (!doc) return true;
      // Being computed: the claim would fail anyway.
      if (doc.computing && doc.computing > now) return false;
      return isRankingStale(doc.computedAt, now);
    })
  ) {
    after(recomputeStaleRankings);
  }
  const books = await findPublicBooks(
    [
      ...new Set(
        docs.flatMap(({ items }) =>
          items.map(({ folderId }) => folderId.toString()),
        ),
      ),
    ].map((id) => new Types.ObjectId(id)),
    hidden,
  );
  const shown = (key: ComputedRanking) =>
    (byKey.get(key)?.items ?? [])
      .flatMap(({ folderId }) => books.get(folderId.toString()) ?? [])
      .slice(0, RANKING_SHOWN);
  return { weekly: shown("weekly"), topRated: shown("topRated") };
}
