import { describe, expect, it } from "vitest";
import {
  collapsedColumns,
  columnsKey,
  DEFAULT_LAYOUT,
  type EditorLayout,
  moveColumn,
  normalizeLayout,
  visibleColumns,
  widthsKey,
} from "./editor-layout";

const custom: EditorLayout = {
  split: true,
  tab: "chapters",
  order: ["chapters", "notes", "tools"],
  collapsed: { notes: true, chapters: false, tools: false },
  widths: {
    "story,chapters": { "story-column": 60, "chapters-column": 40 },
    "story,side": { "story-column": 60, "side-column": 40 },
  },
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
      collapsed: { notes: false, chapters: true, tools: false },
      widths: {
        "story,notes": { "story-column": 70, "notes-column": 30 },
        "story,side": { "story-column": 70, "side-column": 30 },
      },
    });
  });

  it("completes a stored layout from before Tools without resetting it", () => {
    const widths = {
      "story,chapters": { "story-column": 60, "chapters-column": 40 },
      "story,notes": { "story-column": 70, "notes-column": 30 },
      "story,chapters,notes": {
        "story-column": 50,
        "chapters-column": 30,
        "notes-column": 20,
      },
    };
    expect(
      normalizeLayout({
        split: false,
        tab: "chapters",
        order: ["chapters", "notes"],
        collapsed: { notes: true, chapters: false },
        widths,
      }),
    ).toEqual({
      split: false,
      tab: "chapters",
      order: ["chapters", "notes", "tools"],
      collapsed: { notes: true, chapters: false, tools: false },
      widths: {
        ...widths,
        "story,side": { "story-column": 60, "side-column": 40 },
      },
      notesHeights: null,
    });
  });

  it("hides Tools in a stored Split, so its columns and widths stay", () => {
    const layout = normalizeLayout({
      split: true,
      tab: "notes",
      order: ["notes", "chapters"],
      collapsed: { notes: false, chapters: false },
    });
    expect(layout.collapsed.tools).toBe(true);
    expect(visibleColumns(layout)).toEqual(["notes", "chapters"]);
    expect(normalizeLayout(layout)).toEqual(layout);
    expect(
      normalizeLayout({
        ...layout,
        collapsed: { ...layout.collapsed, tools: false },
      }).collapsed.tools,
    ).toBe(false);
  });

  it("keeps the shared tab width once it exists", () => {
    const widths = {
      "story,side": { "story-column": 55, "side-column": 45 },
      "story,notes": { "story-column": 70, "notes-column": 30 },
    };
    expect(normalizeLayout({ widths }).widths).toEqual(widths);
  });

  it("accepts sizes for every Split column set with Tools", () => {
    const widths = {
      "story,tools,notes": {
        "story-column": 60,
        "tools-column": 20,
        "notes-column": 20,
      },
      "story,tools,notes,chapters": {
        "story-column": 40,
        "tools-column": 20,
        "notes-column": 20,
        "chapters-column": 20,
      },
    };
    expect(normalizeLayout({ widths }).widths).toEqual(widths);
  });

  it("drops unknown and repeated panels from the order", () => {
    expect(
      normalizeLayout({ order: ["tools", "other", "tools", 3] }).order,
    ).toEqual(["tools", "notes", "chapters"]);
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
    const { order, collapsed } = DEFAULT_LAYOUT;
    expect(moveColumn(order, "notes", "right", collapsed)).toEqual([
      "chapters",
      "notes",
      "tools",
    ]);
    expect(moveColumn(order, "tools", "left", collapsed)).toEqual([
      "notes",
      "tools",
      "chapters",
    ]);
    expect(moveColumn(order, "notes", "left", collapsed)).toBe(order);
    expect(moveColumn(order, "tools", "right", collapsed)).toBe(order);
  });

  it("moves a column past hidden ones", () => {
    const { order } = DEFAULT_LAYOUT;
    const collapsed = { notes: false, chapters: true, tools: false };
    expect(moveColumn(order, "tools", "left", collapsed)).toEqual([
      "tools",
      "chapters",
      "notes",
    ]);
    expect(
      moveColumn(order, "chapters", "right", {
        ...collapsed,
        chapters: false,
        tools: true,
      }),
    ).toBe(order);
  });

  it("shares one width key between tabs but not between Split columns", () => {
    expect(widthsKey(DEFAULT_LAYOUT)).toBe("story,side");
    expect(widthsKey({ ...DEFAULT_LAYOUT, tab: "tools" })).toBe("story,side");
    expect(widthsKey({ ...DEFAULT_LAYOUT, split: true })).toBe(
      "story,notes,chapters,tools",
    );
    expect(
      widthsKey({
        ...DEFAULT_LAYOUT,
        collapsed: { ...DEFAULT_LAYOUT.collapsed, notes: true },
      }),
    ).toBe("story");
  });

  it("shows the selected tab when not split and every open column when split", () => {
    expect(visibleColumns(DEFAULT_LAYOUT)).toEqual(["notes"]);
    expect(visibleColumns({ ...DEFAULT_LAYOUT, tab: "chapters" })).toEqual([
      "chapters",
    ]);
    expect(visibleColumns({ ...DEFAULT_LAYOUT, split: true })).toEqual([
      "notes",
      "chapters",
      "tools",
    ]);
    expect(visibleColumns(custom)).toEqual(["chapters", "tools"]);
    expect(collapsedColumns(custom)).toEqual(["notes"]);
  });

  it("hides the side panel when its tab is collapsed", () => {
    const layout = {
      ...DEFAULT_LAYOUT,
      collapsed: { notes: true, chapters: false, tools: false },
    };
    expect(visibleColumns(layout)).toEqual([]);
    expect(collapsedColumns(layout)).toEqual(["notes"]);
    expect(columnsKey([])).toBe("story");
    expect(columnsKey(["chapters", "notes"])).toBe("story,chapters,notes");
  });
});
