export type SidePanel = "notes" | "chapters" | "tools";

// Panel id → size in percent, as react-resizable-panels reports it.
export type PanelSizes = Record<string, number>;

export interface EditorLayout {
  tab: SidePanel;
  collapsed: Record<SidePanel, boolean>;
  // Story and side panel sizes, shared by every tab.
  widths: PanelSizes | null;
  notesHeights: PanelSizes | null;
}

export const DEFAULT_LAYOUT: EditorLayout = {
  tab: "notes",
  collapsed: { notes: false, chapters: false, tools: false },
  widths: null,
  notesHeights: null,
};

export const SIDE_PANELS: SidePanel[] = ["notes", "chapters", "tools"];

// Ids of the resizable panels (editor.tsx); anything else in stored sizes is dropped.
const COLUMN_IDS = ["story-column", "side-column"];
const NOTES_PANEL_IDS = ["folder-notes-panel", "chapter-notes-panel"];

// Key of the tab widths when widths were stored per set of columns.
const LEGACY_WIDTHS_KEY = "story,side";

const isSidePanel = (value: unknown): value is SidePanel =>
  SIDE_PANELS.includes(value as SidePanel);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isSizes(value: unknown, ids: string[]): value is PanelSizes {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.entries(value).every(
      ([id, size]) =>
        ids.includes(id) &&
        typeof size === "number" &&
        size >= 0 &&
        size <= 100,
    )
  );
}

function storedWidths(widths: unknown): PanelSizes | null {
  if (isSizes(widths, COLUMN_IDS)) return widths;
  const legacy = isRecord(widths) ? widths[LEGACY_WIDTHS_KEY] : null;
  return isSizes(legacy, COLUMN_IDS) ? legacy : null;
}

// Anything malformed falls back field by field, so an old or edited value never breaks the editor.
export function normalizeLayout(data: unknown): EditorLayout {
  if (!isRecord(data)) return DEFAULT_LAYOUT;

  const collapsed = isRecord(data.collapsed) ? data.collapsed : {};

  return {
    tab: isSidePanel(data.tab) ? data.tab : DEFAULT_LAYOUT.tab,
    collapsed: {
      notes: collapsed.notes === true,
      chapters: collapsed.chapters === true,
      tools: collapsed.tools === true,
    },
    widths: storedWidths(data.widths),
    notesHeights: isSizes(data.notesHeights, NOTES_PANEL_IDS)
      ? data.notesHeights
      : null,
  };
}
