import { describe, expect, it } from "vitest";
import {
  collapsedColumns,
  columnsKey,
  DEFAULT_LAYOUT,
  type EditorLayout,
  moveColumn,
  parseLayout,
  readLayout,
  visibleColumns,
  writeLayout,
} from "./editor-layout";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwing = () => {
  throw new DOMException("Access denied", "SecurityError");
};

const custom: EditorLayout = {
  split: true,
  tab: "chapters",
  order: ["chapters", "notes"],
  collapsed: { notes: true, chapters: false },
  widths: { "story,chapters": { "story-column": 60, "chapters-column": 40 } },
  notesHeights: { "folder-notes-panel": 30, "chapter-notes-panel": 70 },
};

describe("readLayout / writeLayout", () => {
  it("round-trips a layout through storage", () => {
    const storage = memoryStorage();
    expect(writeLayout(() => storage, custom)).toBe(true);
    expect(readLayout(() => storage)).toEqual(custom);
  });

  it("returns the default layout when nothing is stored", () => {
    expect(readLayout(() => memoryStorage())).toEqual(DEFAULT_LAYOUT);
  });

  it("falls back to the default when accessing storage throws", () => {
    expect(readLayout(throwing)).toEqual(DEFAULT_LAYOUT);
    expect(writeLayout(throwing, custom)).toBe(false);
  });

  it("falls back when getItem or setItem throws", () => {
    const storage = memoryStorage();
    storage.getItem = throwing;
    storage.setItem = throwing;
    expect(readLayout(() => storage)).toEqual(DEFAULT_LAYOUT);
    expect(writeLayout(() => storage, custom)).toBe(false);
  });
});

describe("parseLayout", () => {
  it("returns the default for invalid JSON or a non-object", () => {
    for (const raw of ["{", "null", "[]", '"text"', "42"]) {
      expect(parseLayout(raw)).toEqual(DEFAULT_LAYOUT);
    }
  });

  it("replaces malformed fields one by one", () => {
    const raw = JSON.stringify({
      split: "yes",
      tab: "preview",
      order: ["notes", "notes"],
      collapsed: { notes: 1, chapters: true },
      widths: { good: { story: 70, notes: 30 }, bad: { story: "70" } },
      notesHeights: { "folder-notes": 150 },
    });
    expect(parseLayout(raw)).toEqual({
      ...DEFAULT_LAYOUT,
      collapsed: { notes: false, chapters: true },
      widths: { good: { story: 70, notes: 30 } },
    });
  });
});

describe("column helpers", () => {
  it("moves a column left and right, not past either end", () => {
    const order = DEFAULT_LAYOUT.order;
    expect(moveColumn(order, "notes", "right")).toEqual(["chapters", "notes"]);
    expect(moveColumn(order, "chapters", "left")).toEqual([
      "chapters",
      "notes",
    ]);
    expect(moveColumn(order, "notes", "left")).toBe(order);
    expect(moveColumn(order, "chapters", "right")).toBe(order);
  });

  it("shows the selected tab when not split and every open column when split", () => {
    expect(visibleColumns(DEFAULT_LAYOUT)).toEqual(["notes"]);
    expect(visibleColumns({ ...DEFAULT_LAYOUT, tab: "chapters" })).toEqual([
      "chapters",
    ]);
    expect(visibleColumns({ ...DEFAULT_LAYOUT, split: true })).toEqual([
      "notes",
      "chapters",
    ]);
    expect(visibleColumns(custom)).toEqual(["chapters"]);
    expect(collapsedColumns(custom)).toEqual(["notes"]);
  });

  it("hides the side panel when its tab is collapsed", () => {
    const layout = {
      ...DEFAULT_LAYOUT,
      collapsed: { notes: true, chapters: false },
    };
    expect(visibleColumns(layout)).toEqual([]);
    expect(collapsedColumns(layout)).toEqual(["notes"]);
    expect(columnsKey([])).toBe("story");
    expect(columnsKey(["chapters", "notes"])).toBe("story,chapters,notes");
  });
});
