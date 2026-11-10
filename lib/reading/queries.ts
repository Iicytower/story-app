import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { LibraryItem } from "@/lib/models/library-item";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Story } from "@/lib/models/story";
import { chapterSlugs, type ReaderChapter } from "@/lib/publish/queries";
import { newChapterIds } from "@/lib/social/new-chapters";

// The query a chapter page reads to scroll back to the saved position.
export const CONTINUE_PARAM = "continue";

export interface BookReading {
  // The last opened chapter while it is still public.
  continueAt: { title: string; path: string } | null;
  // Only for a book in the reader's library.
  newChapterIds: string[];
}

interface Progress {
  lastStoryId?: Types.ObjectId;
  readStoryIds: Types.ObjectId[];
}

function bookReading(
  chapters: ReaderChapter[],
  progress: Progress | undefined,
  addedAt: Date | undefined,
): BookReading {
  const last = progress?.lastStoryId?.toString();
  const chapter = last ? chapters.find(({ id }) => id === last) : undefined;
  return {
    continueAt: chapter
      ? {
          title: chapter.title,
          path: `${chapter.path}?${CONTINUE_PARAM}=1`,
        }
      : null,
    newChapterIds: addedAt
      ? newChapterIds(
          chapters,
          addedAt,
          (progress?.readStoryIds ?? []).map(String),
        )
      : [],
  };
}

async function progressAndItems(userId: string, folderIds: string[]) {
  const [progress, items] = await Promise.all([
    ReadingProgress.find({ userId, folderId: { $in: folderIds } })
      .select({ folderId: 1, lastStoryId: 1, readStoryIds: 1 })
      .lean(),
    LibraryItem.find({ userId, folderId: { $in: folderIds } })
      .select({ folderId: 1, addedAt: 1 })
      .lean(),
  ]);
  return {
    progress: new Map(progress.map((entry) => [String(entry.folderId), entry])),
    addedAt: new Map(
      items.map(({ folderId, addedAt }) => [String(folderId), addedAt]),
    ),
  };
}

// The contents page, whose public chapters are already loaded.
export async function folderReading(
  userId: string,
  folderId: string,
  chapters: ReaderChapter[],
): Promise<BookReading> {
  await connectDB();
  const { progress, addedAt } = await progressAndItems(userId, [folderId]);
  return bookReading(chapters, progress.get(folderId), addedAt.get(folderId));
}

// The books of a library view, which are public now (D38); keyed by folder id.
export async function libraryReading(
  userId: string,
  books: { folderId: string; path: string }[],
): Promise<Map<string, BookReading>> {
  if (books.length === 0) return new Map();
  await connectDB();
  const folderIds = books.map(({ folderId }) => folderId);
  const [{ progress, addedAt }, folders] = await Promise.all([
    progressAndItems(userId, folderIds),
    Folder.find({ _id: { $in: folderIds } })
      .select({ userId: 1 })
      .lean(),
  ]);
  // Hidden chapters count for the slugs, as on the contents page; userId first for the index.
  const chapters = await Story.find({
    userId: { $in: folders.map(({ userId }) => userId) },
    folderId: { $in: folderIds },
    deletedAt: null,
  })
    .select({ folderId: 1, title: 1, publication: 1, publishedAt: 1 })
    .lean();
  const byFolder = Map.groupBy(chapters, ({ folderId }) => String(folderId));
  return new Map(
    books.map(({ folderId, path }) => {
      const own = byFolder.get(folderId) ?? [];
      const slugs = chapterSlugs(own);
      const visible = own
        .filter(({ publication }) => publication === "public")
        .map(({ _id, title, publishedAt }) => ({
          id: _id.toString(),
          title,
          path: `${path}/${slugs.get(_id.toString())}`,
          publishedAt,
        }));
      return [
        folderId,
        bookReading(visible, progress.get(folderId), addedAt.get(folderId)),
      ];
    }),
  );
}

// Where a chapter page scrolls back to: only the position saved in this chapter.
export async function savedPosition(
  userId: string,
  folderId: string,
  storyId: string,
): Promise<number | null> {
  await connectDB();
  const entry = await ReadingProgress.findOne({
    userId,
    folderId,
    lastStoryId: storyId,
  })
    .select({ position: 1 })
    .lean();
  return entry?.position ?? null;
}
