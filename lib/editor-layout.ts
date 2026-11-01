export type SidePanel = "notes" | "chapters" | "tools";

// Panel id → size in percent, as react-resizable-panels reports it.
export type PanelSizes = Record<string, number>;

export interface EditorLayout {
  split: boolean;
  // Side panel shown when not split.
  tab: SidePanel;
  // Order of the side columns after Story when split.
  order: SidePanel[];
  collapsed: Record<SidePanel, boolean>;
  // Keyed by widthsKey: each set of Split columns has its own sizes, tabs share one.
  widths: Record<string, PanelSizes>;
  notesHeights: PanelSizes | null;
}

export const DEFAULT_LAYOUT: EditorLayout = {
  split: false,
  tab: "notes",
  order: ["notes", "chapters", "tools"],
  collapsed: { notes: false, chapters: false, tools: false },
  widths: {},
  notesHeights: null,
};

export const SIDE_PANELS: SidePanel[] = ["notes", "chapters", "tools"];

// Ids of the resizable panels (editor.tsx); anything else in stored sizes is dropped.
const COLUMN_IDS = [
  "story-column",
  "side-column",
  "notes-column",
  "chapters-column",
  "tools-column",
];
const NOTES_PANEL_IDS = ["folder-notes-panel", "chapter-notes-panel"];

const isSidePanel = (value: unknown): value is SidePanel =>
  SIDE_PANELS.includes(value as SidePanel);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isSizes(value: unknown, ids: string[]): value is PanelSizes {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([id, size]) =>
        ids.includes(id) &&
        typeof size === "number" &&
        size >= 0 &&
        size <= 100,
    )
  );
}

// Every set of visible columns columnsKey can produce.
function columnSets(panels: SidePanel[]): SidePanel[][] {
  return [
    [],
    ...panels.flatMap((panel) =>
      columnSets(panels.filter((other) => other !== panel)).map((rest) => [
        panel,
        ...rest,
      ]),
    ),
  ];
}

const TABS_KEY = "story,side";
const COLUMN_KEYS = new Set([
  TABS_KEY,
  ...columnSets(SIDE_PANELS).map(columnsKey),
]);

// Tabs used to have a width each: the shared one starts from the selected tab's.
function withTabsWidth(
  widths: Record<string, PanelSizes>,
  tab: SidePanel,
): Record<string, PanelSizes> {
  if (widths[TABS_KEY]) return widths;
  for (const panel of [tab, ...SIDE_PANELS]) {
    const sizes = widths[columnsKey([panel])];
    if (!sizes) continue;
    const [story, side] = [sizes["story-column"], sizes[`${panel}-column`]];
    if (story === undefined || side === undefined) continue;
    return {
      ...widths,
      [TABS_KEY]: { "story-column": story, "side-column": side },
    };
  }
  return widths;
}

// Anything malformed falls back field by field, so an old or edited value never breaks the editor.
export function normalizeLayout(data: unknown): EditorLayout {
  if (!isRecord(data)) return DEFAULT_LAYOUT;

  // A panel added later joins the end, so a stored order is never discarded.
  const storedOrder = Array.isArray(data.order) ? data.order : null;
  const order = [
    ...new Set([
      ...(storedOrder ?? []).filter(isSidePanel),
      ...DEFAULT_LAYOUT.order,
    ]),
  ];
  // Stored Split columns from before Tools keep their widths until the user shows it.
  const toolsNew =
    data.split === true && !!storedOrder && !storedOrder.includes("tools");
  const collapsed = isRecord(data.collapsed) ? data.collapsed : {};
  const widths = isRecord(data.widths)
    ? Object.fromEntries(
        Object.entries(data.widths).filter(
          ([key, sizes]) => COLUMN_KEYS.has(key) && isSizes(sizes, COLUMN_IDS),
        ),
      )
    : {};

  const tab = isSidePanel(data.tab) ? data.tab : DEFAULT_LAYOUT.tab;

  return {
    split: typeof data.split === "boolean" ? data.split : DEFAULT_LAYOUT.split,
    tab,
    order,
    collapsed: {
      notes: collapsed.notes === true,
      chapters: collapsed.chapters === true,
      tools: toolsNew || collapsed.tools === true,
    },
    widths: withTabsWidth(widths as Record<string, PanelSizes>, tab),
    notesHeights: isSizes(data.notesHeights, NOTES_PANEL_IDS)
      ? data.notesHeights
      : null,
  };
}

export function moveColumn(
  order: SidePanel[],
  panel: SidePanel,
  direction: "left" | "right",
  collapsed: Record<SidePanel, boolean>,
): SidePanel[] {
  const index = order.indexOf(panel);
  const step = direction === "left" ? -1 : 1;
  // Swapping with a hidden column would change nothing on screen.
  let target = index + step;
  while (collapsed[order[target]]) target += step;
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

export function widthsKey(layout: EditorLayout): string {
  const columns = visibleColumns(layout);
  return layout.split || columns.length === 0 ? columnsKey(columns) : TABS_KEY;
}
