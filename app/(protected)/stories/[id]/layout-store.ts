import { useSyncExternalStore } from "react";
import { saveSettings } from "@/app/(protected)/actions";
import type { EditorLayout } from "@/lib/editor-layout";
import type { MobileView, UserSettings } from "@/lib/settings/settings";

// Dragging a separator reports many sizes; only the last one in this window is saved.
export const LAYOUT_SAVE_DELAY_MS = 500;

type EditorSettings = UserSettings["editor"];

// Module-level, so the layout survives the editor remounting for another chapter while a
// save is still pending (the server copy may be a moment old). Keyed by user: another
// account signed in on this tab starts from its own settings.
let current: { userId: string; settings: EditorSettings } | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(change: Partial<EditorSettings>) {
  if (!current) return;
  current = { ...current, settings: { ...current.settings, ...change } };
  for (const listener of listeners) listener();
}

// The server renders from its own copy and never touches the module state, which
// would be shared between requests.
export function useEditorSettings(
  userId: string,
  initial: EditorSettings,
): EditorSettings {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (current?.userId !== userId) current = { userId, settings: initial };
      return current.settings;
    },
    () => initial,
  );
}

export function flushLayoutSave(): void {
  if (!saveTimer || !current) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  void saveSettings({ editor: { layout: current.settings.layout } });
}

export function updateEditorLayout(
  change: (layout: EditorLayout) => EditorLayout,
): void {
  if (!current) return;
  update({ layout: change(current.settings.layout) });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushLayoutSave, LAYOUT_SAVE_DELAY_MS);
}

export function setMobileView(mobileView: MobileView): void {
  update({ mobileView });
  void saveSettings({ editor: { mobileView } });
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeToViewport(listener: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

// The server renders the desktop layout; a narrow screen switches after hydration.
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
