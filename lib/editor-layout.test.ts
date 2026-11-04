import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  type EditorLayout,
  normalizeLayout,
} from "./editor-layout";

const custom: EditorLayout = {
  tab: "chapters",
  collapsed: { notes: true, chapters: false, tools: false },
  widths: { "story-column": 60, "side-column": 40 },
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
        tab: "preview",
        collapsed: { notes: 1, chapters: true },
        widths: { "story-column": "70" },
        notesHeights: { "folder-notes-panel": 150 },
      }),
    ).toEqual({
      ...DEFAULT_LAYOUT,
      collapsed: { notes: false, chapters: true, tools: false },
    });
  });

  it("drops sizes for unknown panel ids and empty sizes", () => {
    expect(
      normalizeLayout({
        widths: { "story-column": 50, "notes-column": 50 },
        notesHeights: {},
      }),
    ).toMatchObject({ widths: null, notesHeights: null });
  });

  it("turns a stored Split layout into tabs, keeping the tab width", () => {
    expect(
      normalizeLayout({
        split: true,
        tab: "tools",
        order: ["chapters", "notes", "tools"],
        collapsed: { notes: false, chapters: true, tools: false },
        widths: {
          "story,chapters,notes,tools": {
            "story-column": 40,
            "chapters-column": 20,
            "notes-column": 20,
            "tools-column": 20,
          },
          "story,side": { "story-column": 65, "side-column": 35 },
        },
      }),
    ).toEqual({
      tab: "tools",
      collapsed: { notes: false, chapters: true, tools: false },
      widths: { "story-column": 65, "side-column": 35 },
      notesHeights: null,
    });
  });

  it("ignores Split column widths without a tab width", () => {
    expect(
      normalizeLayout({
        split: true,
        widths: {
          "story,notes": { "story-column": 70, "notes-column": 30 },
        },
      }),
    ).toEqual(DEFAULT_LAYOUT);
  });
});
