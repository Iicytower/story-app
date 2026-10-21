import {
  DEFAULT_LAYOUT,
  type EditorLayout,
  normalizeLayout,
} from "@/lib/editor-layout";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

// Below the md breakpoint only one panel is shown at a time.
export const MOBILE_VIEWS = ["story", "notes", "chapters"] as const;
export type MobileView = (typeof MOBILE_VIEWS)[number];

export interface UserSettings {
  editorLayout: EditorLayout;
  mobileView: MobileView;
  // null: follow the system theme.
  theme: Theme | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  editorLayout: DEFAULT_LAYOUT,
  mobileView: "story",
  theme: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme =>
  THEMES.includes(value as Theme);

const isMobileView = (value: unknown): value is MobileView =>
  MOBILE_VIEWS.includes(value as MobileView);

// What the database holds may be partial or stale: each field falls back on its own.
export function normalizeSettings(data: unknown): UserSettings {
  const settings = isRecord(data) ? data : {};
  return {
    editorLayout: normalizeLayout(settings.editorLayout),
    mobileView: isMobileView(settings.mobileView)
      ? settings.mobileView
      : DEFAULT_SETTINGS.mobileView,
    theme: isTheme(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
  };
}

export type SettingsPatch = Partial<UserSettings>;

// A change sent by the client: known fields only, at least one. The layout is
// normalized like stored data; an unknown theme or view rejects the whole patch.
export function parseSettingsPatch(data: unknown): SettingsPatch | null {
  if (!isRecord(data)) return null;
  const patch: SettingsPatch = {};
  if ("editorLayout" in data) {
    patch.editorLayout = normalizeLayout(data.editorLayout);
  }
  if ("mobileView" in data) {
    if (!isMobileView(data.mobileView)) return null;
    patch.mobileView = data.mobileView;
  }
  if ("theme" in data) {
    if (data.theme !== null && !isTheme(data.theme)) return null;
    patch.theme = data.theme;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
