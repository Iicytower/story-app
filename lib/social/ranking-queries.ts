import { Types } from "mongoose";
import { after } from "next/server";
import { isAdult } from "@/lib/adult/adult";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { Ranking, type RankingItem } from "@/lib/models/ranking";
import { Rating } from "@/lib/models/rating";
import { ReadEvent } from "@/lib/models/read-event";
import { Story } from "@/lib/models/story";
import {
  findChapterPaths,
  findPublicBooks,
  type PublicBook,
} from "@/lib/publish/queries";
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
  TAG_RANKING_SHOWN,
  tagRankingKey,
} from "@/lib/social/rankings";
import { statsDay } from "@/lib/social/read-stats";
import { listPredefinedTags } from "@/lib/tags/queries";

const DAY_MS = 24 * 60 * 60 * 1000;
// Followed authors' chapters read before the visibility filter; the section shows RANKING_SHOWN.
const FOLLOWED_CANDIDATES = 30;
// Follows have no count limit; past this many the section reads the latest followed authors.
const FOLLOWED_AUTHORS = 500;

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
    .select({ tags: 1 })
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
  const tagsOf = new Map(
    folders.map(({ _id, tags }) => [_id.toString(), tags ?? []]),
  );
  const ranked = rankByScore(
    counts
      .filter(({ _id }) => tagsOf.has(_id.toString()))
      .map(({ _id, readers }) => ({
        folderId: _id.toString(),
        score: readers,
      })),
  );
  const predefined = await listPredefinedTags();
  const byTag = predefined.flatMap(({ key }) => {
    const books = ranked.filter(({ folderId }) =>
      tagsOf.get(folderId)!.includes(key),
    );
    return books.length > 0 ? [{ key, items: toItems(books) }] : [];
  });
  return { items: toItems(ranked), byTag };
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
  const { items, byTag } = await computeWeekly(now, banned);
  // A lost lease: a newer computation owns the result.
  if ((await finish(items)).modifiedCount === 0) return false;
  // The categories come with the weekly ranking; a category with no books this week goes.
  // An older computation never overwrites a newer one's categories.
  await Ranking.deleteMany({
    _id: {
      $regex: /^tag:/,
      $nin: byTag.map(({ key }) => tagRankingKey(key)),
    },
    computedAt: { $lte: now },
  });
  if (byTag.length > 0) {
    await Ranking.bulkWrite(
      // The upsert matches _id alone, so it never collides with a newer document.
      byTag.flatMap(({ key, items }) => [
        {
          updateOne: {
            filter: { _id: tagRankingKey(key) },
            update: { $setOnInsert: { items: [], computedAt: new Date(0) } },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { _id: tagRankingKey(key), computedAt: { $lte: now } },
            update: { $set: { items, computedAt: now } },
          },
        },
      ]),
    );
  }
  return true;
}

export async function recomputeStaleRankings(): Promise<void> {
  await Promise.all(COMPUTED.map(recomputeRanking));
}

export interface FollowedChapter {
  title: string;
  path: string;
  adult: boolean;
  book: PublicBook;
}

// Counted live: the latest public chapters of the authors the viewer follows (D38 at read time).
async function followedChapters(
  viewerId: string,
  hidden: Types.ObjectId[],
): Promise<FollowedChapter[]> {
  const follows = await Follow.find(
    { followerId: viewerId },
    { _id: 0, followeeId: 1 },
  )
    .sort({ createdAt: -1, _id: -1 })
    .limit(FOLLOWED_AUTHORS)
    .lean();
  const hiddenIds = new Set(hidden.map(String));
  const authorIds = follows
    .map(({ followeeId }) => followeeId)
    .filter((id) => !hiddenIds.has(id.toString()));
  if (authorIds.length === 0) return [];
  const stories = await Story.find({
    userId: { $in: authorIds },
    publication: "public",
    publishedAt: { $type: "date" },
    deletedAt: null,
  })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(FOLLOWED_CANDIDATES)
    .select({ userId: 1, folderId: 1, title: 1, adult: 1 })
    .lean();
  const books = await findPublicBooks(
    [...new Set(stories.map(({ folderId }) => folderId.toString()))].map(
      (id) => new Types.ObjectId(id),
    ),
    hidden,
  );
  const visible = stories
    .filter(({ folderId }) => books.has(folderId.toString()))
    .slice(0, RANKING_SHOWN);
  const paths = await findChapterPaths(
    visible,
    new Map(
      visible.map(({ userId, folderId }) => [
        userId.toString(),
        books.get(folderId.toString())!.nickname,
      ]),
    ),
  );
  return visible.map((story) => {
    const book = books.get(story.folderId.toString())!;
    return {
      title: story.title,
      path: paths.get(story._id.toString())!,
      adult: book.adult || isAdult(story.adult),
      book,
    };
  });
}

export interface HomeRankings {
  weekly: PublicBook[];
  topRated: PublicBook[];
  // Predefined tags only, in the stored order; the page sorts them by label.
  tags: { key: string; books: PublicBook[] }[];
  // null for a guest.
  followed: FollowedChapter[] | null;
}

// Stored rankings filtered for the viewer: D38, global bans and blocks both ways (as the feed).
// A stale ranking is shown as it is and recomputed after the response.
export async function getHomeRankings(
  viewerId: string | null,
): Promise<HomeRankings> {
  await connectDB();
  const now = new Date();
  const [docs, hidden, predefined] = await Promise.all([
    Ranking.find().select({ items: 1, computedAt: 1, computing: 1 }).lean(),
    viewerId ? feedHiddenUserIds(viewerId) : hiddenUserIdsFor(null),
    listPredefinedTags(),
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
  const shown = (key: string, limit: number) =>
    (byKey.get(key)?.items ?? [])
      .flatMap(({ folderId }) => books.get(folderId.toString()) ?? [])
      .slice(0, limit);
  return {
    weekly: shown("weekly", RANKING_SHOWN),
    topRated: shown("topRated", RANKING_SHOWN),
    tags: predefined
      .map(({ key }) => ({
        key,
        books: shown(tagRankingKey(key), TAG_RANKING_SHOWN),
      }))
      .filter(({ books }) => books.length > 0),
    followed: viewerId ? await followedChapters(viewerId, hidden) : null,
  };
}
