import { connectDB } from "@/lib/db";
import { DailyStat } from "@/lib/models/daily-stat";
import { ReadEvent } from "@/lib/models/read-event";
import { clientHash, clientIp } from "@/lib/rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;
export const READ_EVENT_TTL_MS = 30 * DAY_MS;

// A UTC day as stored in readEvents and dailyStats.
export function statsDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// A guest without a trusted address is not counted (D74): one shared key would count everyone once.
export function readerKey(
  viewerId: string | null,
  headers: Headers,
): string | null {
  if (viewerId) return `u:${viewerId}`;
  const ip = clientIp(headers);
  return ip === null ? null : `g:${clientHash(ip)}`;
}

// Next.js marks its own prefetches; browsers mark speculative loads with Sec-Purpose or Purpose.
function isPrefetch(headers: Headers): boolean {
  return (
    headers.has("next-router-prefetch") ||
    /prefetch/i.test(headers.get("sec-purpose") ?? "") ||
    /prefetch/i.test(headers.get("purpose") ?? "")
  );
}

// The reader of a chapter page shown in full: not a prefetch and not its author (task 83).
export function chapterReader(
  viewerId: string | null,
  authorId: string,
  headers: Headers,
): string | null {
  if (isPrefetch(headers) || viewerId === authorId) return null;
  return readerKey(viewerId, headers);
}

export interface ChapterRead {
  storyId: string;
  folderId: string;
  authorId: string;
  reader: string;
}

function countReader(read: ChapterRead, day: string) {
  return DailyStat.updateOne(
    { storyId: read.storyId, day },
    {
      $inc: { readers: 1 },
      $setOnInsert: { folderId: read.folderId, authorId: read.authorId },
    },
    { upsert: true },
  );
}

// Only a new entry counts, so the same reader on the same day is one reader however often and
// however concurrently they open the chapter. Both filters match a unique index exactly, so the
// server retries a parallel upsert's duplicate key instead of failing (MongoDB >= 4.2).
export async function recordRead(read: ChapterRead): Promise<void> {
  await connectDB();
  const now = new Date();
  const day = statsDay(now);
  const { upsertedCount } = await ReadEvent.updateOne(
    { storyId: read.storyId, day, reader: read.reader },
    {
      $setOnInsert: {
        folderId: read.folderId,
        expiresAt: new Date(now.getTime() + READ_EVENT_TTL_MS),
      },
    },
    { upsert: true },
  );
  if (upsertedCount === 1) await countReader(read, day);
}
