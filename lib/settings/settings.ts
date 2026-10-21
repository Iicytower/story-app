import {
  DEFAULT_LAYOUT,
  type EditorLayout,
  normalizeLayout,
} from "@/lib/editor-layout";
import { FOLDER_SORTS, type FolderSort } from "@/lib/folders/sort";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

// Below the md breakpoint only one panel is shown at a time.
export const MOBILE_VIEWS = ["story", "notes", "chapters"] as const;
export type MobileView = (typeof MOBILE_VIEWS)[number];

interface Field<T> {
  default: T;
  // undefined: not a valid value.
  parse: (value: unknown) => T | undefined;
  // Fields with a dedicated Server Action (e.g. the folder sort, which also sets positions)
  // are not accepted by saveSettings.
  clientWritable: boolean;
}

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown) =>
    values.includes(value as T) ? (value as T) : undefined;

const field = <T>(
  defaultValue: T,
  parse: (value: unknown) => T | undefined,
  clientWritable = true,
): Field<T> => ({ default: defaultValue, parse, clientWritable });

// Every setting with its default and validation. A new one is added here and to the
// Settings model. Only chosen values are stored, so a changed default reaches everyone.
const SETTINGS = {
  editor: {
    layout: field<EditorLayout>(DEFAULT_LAYOUT, normalizeLayout),
    mobileView: field<MobileView>("story", oneOf(MOBILE_VIEWS)),
  },
  appearance: {
    // null: follow the system theme.
    theme: field<Theme | null>(null, (value) =>
      value === null ? null : oneOf(THEMES)(value),
    ),
  },
  folders: {
    sort: field<FolderSort>("updated", oneOf(FOLDER_SORTS), false),
    // Set on the first switch to manual, which takes positions from the order shown until then.
    manualOrder: field(
      false,
      (value) => (typeof value === "boolean" ? value : undefined),
      false,
    ),
  },
};

type Schema = typeof SETTINGS;
type Group = keyof Schema;

export type UserSettings = {
  [G in Group]: {
    [K in keyof Schema[G]]: Schema[G][K] extends Field<infer T> ? T : never;
  };
};

export type SettingsPatch = {
  [G in Group]?: Partial<UserSettings[G]>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fields(): [Group, string, Field<unknown>][] {
  return Object.entries(SETTINGS).flatMap(([group, groupFields]) =>
    Object.entries(groupFields).map(
      ([key, definition]) =>
        [group as Group, key, definition as Field<unknown>] as const,
    ),
  ) as [Group, string, Field<unknown>][];
}

function build(
  value: (group: Group, key: string, definition: Field<unknown>) => unknown,
): UserSettings {
  const settings: Record<string, Record<string, unknown>> = {};
  for (const [group, key, definition] of fields()) {
    (settings[group] ??= {})[key] = value(group, key, definition);
  }
  return settings as UserSettings;
}

export const DEFAULT_SETTINGS: UserSettings = build(
  (_group, _key, definition) => definition.default,
);

// What the database holds may be partial or stale: each field falls back on its own.
export function normalizeSettings(data: unknown): UserSettings {
  const stored = isRecord(data) ? data : {};
  return build((group, key, definition) => {
    const values = stored[group];
    const parsed = isRecord(values) ? definition.parse(values[key]) : undefined;
    return parsed === undefined ? definition.default : parsed;
  });
}

// A change sent by the client: known, client-writable fields only, at least one.
// The layout is normalized like stored data; any other invalid value rejects the patch.
export function parseSettingsPatch(data: unknown): SettingsPatch | null {
  if (!isRecord(data)) return null;
  const patch: Record<string, Record<string, unknown>> = {};
  for (const [group, values] of Object.entries(data)) {
    const groupFields: Record<string, Field<unknown>> | undefined =
      SETTINGS[group as Group];
    if (!groupFields || !isRecord(values)) return null;
    for (const [key, value] of Object.entries(values)) {
      const definition = Object.hasOwn(groupFields, key)
        ? groupFields[key]
        : undefined;
      if (!definition?.clientWritable) return null;
      const parsed = definition.parse(value);
      if (parsed === undefined) return null;
      (patch[group] ??= {})[key] = parsed;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

// Dotted paths for $set, so a change to one field keeps the rest of its group.
export function settingsUpdate(patch: SettingsPatch): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).flatMap(([group, values]) =>
      Object.entries(values ?? {}).map(([key, value]) => [
        `${group}.${key}`,
        value,
      ]),
    ),
  );
}
