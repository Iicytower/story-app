import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Folder } from "@/lib/models/folder";
import { MAX_MARKS_PER_ACCOUNT } from "@/lib/limits";
import { LibraryItem } from "@/lib/models/library-item";
import { ReaderMark, type ReaderMarkKind } from "@/lib/models/reader-mark";
import { ReadingProgress } from "@/lib/models/reading-progress";
import { Story } from "@/lib/models/story";
import { chapterSlugs, type ReaderChapter } from "@/lib/publish/queries";
import { newChapterIds } from "@/lib/social/new-chapters";
import { MARK_PARAM } from "./marks";

// The query a chapter page reads to scroll back to the saved position.
export const CONTINUE_PARAM = "continue";

export interface BookReading {
  // The last opened chapter while it is still public.
  continueAt: { title: string; path: string } | null;
  // Only for a book in the reader's library.
  newChapterIds: string[];
}

// A bookmark or note listed with its book in the library, in a chapter that is still public.
export interface BookMark {
  id: string;
  kind: ReaderMarkKind;
  // The bookmark's name or the note's quote; an unnamed bookmark shows its position.
  label: string;
  position: number;
  chapter: string;
  path: string;
}

export interface LibraryBookReading extends BookReading {
  marks: BookMark[];
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
): Promise<Map<string, LibraryBookReading>> {
  if (books.length === 0) return new Map();
  await connectDB();
  const folderIds = books.map(({ folderId }) => folderId);
  const [{ progress, addedAt }, folders, marks] = await Promise.all([
    progressAndItems(userId, folderIds),
    Folder.find({ _id: { $in: folderIds } })
      .select({ userId: 1 })
      .lean(),
    ReaderMark.find({ userId, folderId: { $in: folderIds } })
      .select({
        storyId: 1,
        folderId: 1,
        kind: 1,
        name: 1,
        quote: 1,
        position: 1,
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_MARKS_PER_ACCOUNT)
      .lean(),
  ]);
  const marksByFolder = Map.groupBy(marks, ({ folderId }) => String(folderId));
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
      const byId = new Map(visible.map((chapter) => [chapter.id, chapter]));
      const bookMarks = (marksByFolder.get(folderId) ?? []).flatMap((mark) => {
        const chapter = byId.get(String(mark.storyId));
        if (!chapter) return [];
        const id = mark._id.toString();
        return [
          {
            id,
            kind: mark.kind,
            label: (mark.kind === "bookmark" ? mark.name : mark.quote) ?? "",
            position: mark.position,
            chapter: chapter.title,
            path: `${chapter.path}?${MARK_PARAM}=${id}`,
          },
        ];
      });
      return [
        folderId,
        {
          ...bookReading(
            visible,
            progress.get(folderId),
            addedAt.get(folderId),
          ),
          marks: bookMarks,
        },
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
