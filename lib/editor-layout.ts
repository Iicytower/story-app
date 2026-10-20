export type SidePanel = "notes" | "chapters";

// Panel id → size in percent, as react-resizable-panels reports it.
export type PanelSizes = Record<string, number>;

export interface EditorLayout {
  split: boolean;
  // Side panel shown when not split.
  tab: SidePanel;
  // Order of the side columns after Story when split.
  order: SidePanel[];
  collapsed: Record<SidePanel, boolean>;
  // Keyed by the visible column ids (see columnsKey), since each set has its own sizes.
  widths: Record<string, PanelSizes>;
  notesHeights: PanelSizes | null;
}

export const DEFAULT_LAYOUT: EditorLayout = {
  split: false,
  tab: "notes",
  order: ["notes", "chapters"],
  collapsed: { notes: false, chapters: false },
  widths: {},
  notesHeights: null,
};

export const LAYOUT_STORAGE_KEY = "story-app:editor-layout";

const SIDE_PANELS: SidePanel[] = ["notes", "chapters"];

const isSidePanel = (value: unknown): value is SidePanel =>
  SIDE_PANELS.includes(value as SidePanel);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isSizes(value: unknown): value is PanelSizes {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (size) => typeof size === "number" && size >= 0 && size <= 100,
    )
  );
}

// Anything malformed falls back field by field, so an old or edited value never breaks the editor.
export function parseLayout(raw: string | null): EditorLayout {
  let data: unknown;
  try {
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (!isRecord(data)) return DEFAULT_LAYOUT;

  const order =
    Array.isArray(data.order) &&
    data.order.length === SIDE_PANELS.length &&
    SIDE_PANELS.every((panel) => (data.order as unknown[]).includes(panel))
      ? (data.order as SidePanel[])
      : DEFAULT_LAYOUT.order;
  const collapsed = isRecord(data.collapsed) ? data.collapsed : {};
  const widths = isRecord(data.widths)
    ? Object.fromEntries(
        Object.entries(data.widths).filter(([, sizes]) => isSizes(sizes)),
      )
    : {};

  return {
    split: typeof data.split === "boolean" ? data.split : DEFAULT_LAYOUT.split,
    tab: isSidePanel(data.tab) ? data.tab : DEFAULT_LAYOUT.tab,
    order,
    collapsed: {
      notes: collapsed.notes === true,
      chapters: collapsed.chapters === true,
    },
    widths: widths as Record<string, PanelSizes>,
    notesHeights: isSizes(data.notesHeights) ? data.notesHeights : null,
  };
}

// Takes a getter: in some browsers merely reading window.localStorage throws.
export function readLayout(storage: () => Storage): EditorLayout {
  try {
    return parseLayout(storage().getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeLayout(
  storage: () => Storage,
  layout: EditorLayout,
): boolean {
  try {
    storage().setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

export function moveColumn(
  order: SidePanel[],
  panel: SidePanel,
  direction: "left" | "right",
): SidePanel[] {
  const index = order.indexOf(panel);
  const target = direction === "left" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= order.length) return order;
  const result = [...order];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function visibleColumns(layout: EditorLayout): SidePanel[] {
  if (layout.split) return layout.order.filter((p) => !layout.collapsed[p]);
  return layout.collapsed[layout.tab] ? [] : [layout.tab];
}

export function collapsedColumns(layout: EditorLayout): SidePanel[] {
  if (layout.split) return layout.order.filter((p) => layout.collapsed[p]);
  return layout.collapsed[layout.tab] ? [layout.tab] : [];
}

export function columnsKey(columns: SidePanel[]): string {
  return ["story", ...columns].join(",");
}
