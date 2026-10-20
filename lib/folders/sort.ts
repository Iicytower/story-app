import type { mongo } from "mongoose";

export const FOLDER_SORTS = ["updated", "manual", "alpha"] as const;
export type FolderSort = (typeof FOLDER_SORTS)[number];

export const CHAPTER_SORTS = ["created", "manual", "alpha"] as const;
export type ChapterSort = (typeof CHAPTER_SORTS)[number];

export type Direction = "up" | "down";

export interface Order {
  sort: Record<string, 1 | -1>;
  collation?: mongo.CollationOptions;
}

// Strength 2 ignores case only; the Polish locale puts "ł" between "l" and "m".
const ALPHA_COLLATION: mongo.CollationOptions = { locale: "pl", strength: 2 };

export function folderOrder(mode: FolderSort): Order {
  switch (mode) {
    case "manual":
      return { sort: { position: 1, _id: 1 } };
    case "alpha":
      return { sort: { name: 1, _id: 1 }, collation: ALPHA_COLLATION };
    default:
      return { sort: { lastActivityAt: -1, _id: -1 } };
  }
}

export function chapterOrder(mode: ChapterSort): Order {
  switch (mode) {
    case "manual":
      return { sort: { position: 1, _id: 1 } };
    case "alpha":
      return { sort: { title: 1, _id: 1 }, collation: ALPHA_COLLATION };
    default:
      return { sort: { createdAt: -1, _id: -1 } };
  }
}

export function isFolderSort(value: unknown): value is FolderSort {
  return FOLDER_SORTS.includes(value as FolderSort);
}

export function isChapterSort(value: unknown): value is ChapterSort {
  return CHAPTER_SORTS.includes(value as ChapterSort);
}

export function isDirection(value: unknown): value is Direction {
  return value === "up" || value === "down";
}
