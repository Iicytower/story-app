import { diffWordsWithSpace } from "diff";
import type { ActionError } from "@/lib/action-result";

export const VERSION_NAME_MAX_LENGTH = 100;

export function validateVersionName(
  name: string,
): { ok: true; name: string } | ActionError {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "EMPTY_NAME",
      message: "Version name is required.",
    };
  }
  if (trimmed.length > VERSION_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: `Version name can have at most ${VERSION_NAME_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, name: trimmed };
}

export const beforeRestoreName = (number: number) =>
  `Before restoring version ${number}`;

// attempt 1 is the title itself, then "Title (2)", "Title (3)"… as in migration 002.
export const numberedTitle = (title: string, attempt: number) =>
  attempt === 1 ? title : `${title} (${attempt})`;

export type DiffPart = { value: string; added: boolean; removed: boolean };

// A long chapter rewritten from scratch would take too long to compare word by word.
const MAX_EDIT_LENGTH = 5000;
const DIFF_TIMEOUT_MS = 500;

// From the version's text to the current one; null when there are too many changes.
export function textDiff(before: string, after: string): DiffPart[] | null {
  const changes = diffWordsWithSpace(before, after, {
    maxEditLength: MAX_EDIT_LENGTH,
    timeout: DIFF_TIMEOUT_MS,
  });
  return (
    changes?.map(({ value, added, removed }) => ({ value, added, removed })) ??
    null
  );
}

export interface ChapterState {
  title: string;
  content: string;
  notes: string;
}

const FIELDS = ["title", "content", "notes"] as const;
export type ChapterField = (typeof FIELDS)[number];

export type FieldDiff = { field: ChapterField; parts: DiffPart[] | null };

export type ComparedChapter =
  | { storyId: string; title: string; status: "unchanged" | "deleted" }
  | { storyId: string; title: string; status: "changed"; diffs: FieldDiff[] };

export interface VersionComparison {
  chapters: ComparedChapter[];
  // Current chapters the version does not have; restoring never touches them.
  added: { id: string; title: string }[];
}

// "deleted" covers chapters deleted since and chapters moved to another folder:
// either way they are not among the folder's current chapters.
export function compareVersion(
  saved: (ChapterState & { storyId: string })[],
  current: (ChapterState & { id: string })[],
): VersionComparison {
  const currentById = new Map(current.map((chapter) => [chapter.id, chapter]));
  const chapters = saved.map((chapter): ComparedChapter => {
    const { storyId, title } = chapter;
    const now = currentById.get(storyId);
    if (!now) return { storyId, title, status: "deleted" };
    const diffs = FIELDS.filter((field) => chapter[field] !== now[field]).map(
      (field) => ({ field, parts: textDiff(chapter[field], now[field]) }),
    );
    return diffs.length === 0
      ? { storyId, title, status: "unchanged" }
      : { storyId, title, status: "changed", diffs };
  });
  const savedIds = new Set(saved.map((chapter) => chapter.storyId));
  return {
    chapters,
    added: current
      .filter((chapter) => !savedIds.has(chapter.id))
      .map(({ id, title }) => ({ id, title })),
  };
}
