import { describe, expect, it } from "vitest";
import {
  collapsedColumns,
  columnsKey,
  DEFAULT_LAYOUT,
  type EditorLayout,
  moveColumn,
  normalizeLayout,
  visibleColumns,
} from "./editor-layout";

const custom: EditorLayout = {
  split: true,
  tab: "chapters",
  order: ["chapters", "notes"],
  collapsed: { notes: true, chapters: false },
  widths: { "story,chapters": { "story-column": 60, "chapters-column": 40 } },
  notesHeights: { "folder-notes-panel": 30, "chapter-notes-panel": 70 },
};

describe("normalizeLayout", () => {
  it("keeps a valid layout", () => {
    expect(normalizeLayout(custom)).toEqual(custom);
  });

  it("returns the default for a missing value or a non-object", () => {
    for (const data of [undefined, null, [], "text", 42]) {
      expect(normalizeLayout(data)).toEqual(DEFAULT_LAYOUT);
    }
  });

  it("replaces malformed fields one by one", () => {
    expect(
      normalizeLayout({
        split: "yes",
        tab: "preview",
        order: ["notes", "notes"],
        collapsed: { notes: 1, chapters: true },
        widths: {
          "story,notes": { "story-column": 70, "notes-column": 30 },
          "story,chapters": { "story-column": "70" },
        },
        notesHeights: { "folder-notes-panel": 150 },
      }),
    ).toEqual({
      ...DEFAULT_LAYOUT,
      collapsed: { notes: false, chapters: true },
      widths: { "story,notes": { "story-column": 70, "notes-column": 30 } },
    });
  });

  it("drops sizes for unknown column sets and panel ids", () => {
    expect(
      normalizeLayout({
        widths: {
          anything: { "story-column": 50 },
          story: { "story-column": 100, other: 0 },
        },
        notesHeights: { "folder-notes-panel": 40, extra: 60 },
      }),
    ).toMatchObject({ widths: {}, notesHeights: null });
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
