// Where each scrolling part of the editor was, per chapter, so reopening it (or remounting
// a panel) starts there. Kept in localStorage only: not worth a database write per scroll.

// The top-level block at the top edge of a text view and how far into it the view starts (0–1).
// Unlike pixels, it still fits after the column width or the mode changes.
export type Anchor = { index: number; fraction: number };

// Text fields store an anchor, plain lists a scrollTop in pixels.
export type ScrollPosition = Anchor | number;

export type ScrollEntry = {
  savedAt: number;
  positions: Record<string, ScrollPosition>;
};

export type ScrollEntries = Record<string, ScrollEntry>;

export const SCROLL_STORAGE_KEY = "story-app:scroll";
export const MAX_SCROLL_ENTRIES = 50;
export const SCROLL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SCROLL_SAVE_DELAY_MS = 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isPosition(value: unknown): value is ScrollPosition {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  return (
    isRecord(value) &&
    Number.isInteger(value.index) &&
    (value.index as number) >= 0 &&
    typeof value.fraction === "number" &&
    value.fraction >= 0 &&
    value.fraction <= 1
  );
}

// Malformed entries and positions are dropped one by one, so an old or edited value never breaks the editor.
export function parseScrollEntries(raw: string | null): ScrollEntries {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (!isRecord(data)) return {};
  const entries: ScrollEntries = {};
  for (const [id, entry] of Object.entries(data)) {
    if (
      !isRecord(entry) ||
      typeof entry.savedAt !== "number" ||
      !isRecord(entry.positions)
    )
      continue;
    entries[id] = {
      savedAt: entry.savedAt,
      positions: Object.fromEntries(
        Object.entries(entry.positions).filter(([, value]) =>
          isPosition(value),
        ),
      ) as Record<string, ScrollPosition>,
    };
  }
  return entries;
}

// Drops entries older than the TTL, then all but the most recently saved ones.
export function pruneScrollEntries(
  entries: ScrollEntries,
  now: number,
): ScrollEntries {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => now - entry.savedAt <= SCROLL_TTL_MS)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, MAX_SCROLL_ENTRIES),
  );
}

// Module-level, so a panel remounting (Split, Hide/Show) finds the position before the delayed write.
let memory: ScrollEntries | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Every access to localStorage may throw (blocked storage, private mode); the window getter too.
function load(): ScrollEntries {
  if (memory) return memory;
  try {
    memory = pruneScrollEntries(
      parseScrollEntries(window.localStorage.getItem(SCROLL_STORAGE_KEY)),
      Date.now(),
    );
  } catch {
    memory = {};
  }
  return memory;
}

export function flushScrollSave(): void {
  if (!saveTimer || !memory) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  memory = pruneScrollEntries(memory, Date.now());
  try {
    window.localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(memory));
  } catch {}
}

export function recallScroll(
  storyId: string,
  field: string,
): ScrollPosition | null {
  return load()[storyId]?.positions[field] ?? null;
}

// null means the top, which needs no entry.
export function rememberScroll(
  storyId: string,
  field: string,
  position: ScrollPosition | null,
): void {
  const entries = load();
  if (position === null && !entries[storyId]) return;
  const positions = { ...entries[storyId]?.positions };
  if (position === null) delete positions[field];
  else positions[field] = position;
  entries[storyId] = { savedAt: Date.now(), positions };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushScrollSave, SCROLL_SAVE_DELAY_MS);
}
