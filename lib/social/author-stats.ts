import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import type { ChapterSort } from "@/lib/folders/sort";
import { Comment } from "@/lib/models/comment";
import { DailyStat } from "@/lib/models/daily-stat";
import { Folder } from "@/lib/models/folder";
import { Follow } from "@/lib/models/follow";
import { LibraryItem } from "@/lib/models/library-item";
import { Rating } from "@/lib/models/rating";
import { Reaction } from "@/lib/models/reaction";
import { Story } from "@/lib/models/story";
import { hiddenUserIdsFor } from "@/lib/social/permissions";
import { statsDay } from "@/lib/social/read-stats";

export const STATS_RANGES = [7, 30, 90, 365] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const DEFAULT_STATS_RANGE: StatsRange = 30;

export function parseStatsRange(value: unknown): StatsRange {
  return (
    STATS_RANGES.find((range) => String(range) === value) ?? DEFAULT_STATS_RANGE
  );
}

// The statistics page and its sidebar entry are for an author with a publication (D80).
export async function hasPublication(userId: string): Promise<boolean> {
  await connectDB();
  return (
    (await Folder.exists({ userId, published: true, deletedAt: null })) !== null
  );
}

export interface StatsRow {
  id: string;
  title: string;
  readers: number;
  reactions: number;
  ratingCount: number;
  ratingSum: number;
  comments: number;
}

export interface BookStats extends StatsRow {
  library: number;
  chapters: StatsRow[];
}

export interface AuthorStats {
  days: { day: string; readers: number }[];
  followers: number;
  books: BookStats[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeDays(range: StatsRange, now: Date): string[] {
  return Array.from({ length: range }, (_, index) =>
    statsDay(new Date(now.getTime() - (range - 1 - index) * DAY_MS)),
  );
}

interface ChapterOrderFields {
  _id: Types.ObjectId;
  title: string;
  position?: number;
  createdAt: Date;
}

// The public reading order (lib/publish/queries.ts): "Newest first" is read from the oldest.
function inReadingOrder<T extends ChapterOrderFields>(
  chapters: T[],
  sort: ChapterSort,
  locale: string,
): T[] {
  const byId = (a: T, b: T) => String(a._id).localeCompare(String(b._id));
  return chapters.toSorted((a, b) => {
    if (sort === "manual") {
      return (a.position ?? 0) - (b.position ?? 0) || byId(a, b);
    }
    if (sort === "alpha") {
      return a.title.localeCompare(b.title, locale) || byId(a, b);
    }
    return a.createdAt.getTime() - b.createdAt.getTime() || byId(a, b);
  });
}

function counts(groups: { _id: unknown; count: number }[]) {
  return new Map(groups.map(({ _id, count }) => [String(_id), count]));
}

// Only the session's own data: every query matches authorId (or own folders). Readers are unique
// per day and summed over the range; the other numbers are totals. Ratings, comments and
// followers leave out globally banned accounts like the public counters (task 78).
export async function getAuthorStats(
  userId: string,
  range: StatsRange,
  locale: string,
  now = new Date(),
): Promise<AuthorStats> {
  await connectDB();
  const authorId = new Types.ObjectId(userId);
  const days = rangeDays(range, now);
  const [folders, publicChapters, banned] = await Promise.all([
    Folder.find({ userId, published: true, deletedAt: null })
      .select({ name: 1, chapterSort: 1 })
      .lean(),
    Story.find({ userId, deletedAt: null, publication: "public" })
      .select({ title: 1, folderId: 1, position: 1, createdAt: 1 })
      .lean(),
    hiddenUserIdsFor(null),
  ]);
  const folderIds = folders.map(({ _id }) => _id);
  const shown = new Set(folderIds.map(String));
  const chapters = publicChapters.filter(
    ({ folderId }) => folderId && shown.has(String(folderId)),
  );
  // The chart and the table count the same chapters, so their totals agree.
  const readers = {
    authorId,
    storyId: { $in: chapters.map(({ _id }) => _id) },
    day: { $gte: days[0] },
  };
  const [perDay, perChapter, reactions, ratings, comments, library, followers] =
    await Promise.all([
      DailyStat.aggregate<{ _id: string; count: number }>([
        { $match: readers },
        { $group: { _id: "$day", count: { $sum: "$readers" } } },
      ]),
      DailyStat.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: readers },
        { $group: { _id: "$storyId", count: { $sum: "$readers" } } },
      ]),
      Reaction.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { authorId, targetType: "story" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } },
      ]),
      Rating.aggregate<{ _id: Types.ObjectId; count: number; sum: number }>([
        { $match: { authorId, userId: { $nin: banned } } },
        {
          $group: {
            _id: "$targetId",
            count: { $sum: 1 },
            sum: { $sum: "$value" },
          },
        },
      ]),
      Comment.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            authorId,
            deletedAt: null,
            hidden: { $exists: false },
            userId: { $nin: banned },
          },
        },
        // The book's own thread has no chapter.
        {
          $group: {
            _id: { $ifNull: ["$storyId", "$folderId"] },
            count: { $sum: 1 },
          },
        },
      ]),
      LibraryItem.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { folderId: { $in: folderIds } } },
        { $group: { _id: "$folderId", count: { $sum: 1 } } },
      ]),
      Follow.countDocuments({
        followeeId: authorId,
        followerId: { $nin: banned },
      }),
    ]);
  const readersOf = counts(perChapter);
  const reactionsOf = counts(reactions);
  const commentsOf = counts(comments);
  const libraryOf = counts(library);
  const ratingsOf = new Map(
    ratings.map(({ _id, count, sum }) => [String(_id), { count, sum }]),
  );
  const row = (id: string, title: string): StatsRow => ({
    id,
    title,
    readers: readersOf.get(id) ?? 0,
    reactions: reactionsOf.get(id) ?? 0,
    ratingCount: ratingsOf.get(id)?.count ?? 0,
    ratingSum: ratingsOf.get(id)?.sum ?? 0,
    comments: commentsOf.get(id) ?? 0,
  });
  const books = folders
    .map((folder): BookStats => {
      const id = folder._id.toString();
      const rows = inReadingOrder(
        chapters.filter(({ folderId }) => String(folderId) === id),
        folder.chapterSort ?? "created",
        locale,
      ).map(({ _id, title }) => row(_id.toString(), title));
      const own = row(id, folder.name);
      const sum = (key: "readers" | "reactions" | "comments") =>
        rows.reduce((total, chapter) => total + chapter[key], 0);
      return {
        ...own,
        readers: sum("readers"),
        reactions: sum("reactions"),
        comments: own.comments + sum("comments"),
        library: libraryOf.get(id) ?? 0,
        chapters: rows,
      };
    })
    .toSorted((a, b) => a.title.localeCompare(b.title, locale));
  const perDayOf = counts(perDay);
  return {
    days: days.map((day) => ({ day, readers: perDayOf.get(day) ?? 0 })),
    followers,
    books,
  };
}
