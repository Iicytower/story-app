import { useSyncExternalStore } from "react";
import {
  DEFAULT_LAYOUT,
  type EditorLayout,
  readLayout,
  writeLayout,
} from "@/lib/editor-layout";

// Module-level, so the layout survives the editor remounting for another chapter,
// and keeps working for the session when localStorage is unavailable.
let current: EditorLayout | null = null;
const listeners = new Set<() => void>();
const storage = () => window.localStorage;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): EditorLayout {
  current ??= readLayout(storage);
  return current;
}

export function useEditorLayout(): EditorLayout {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LAYOUT);
}

export function updateEditorLayout(
  update: (layout: EditorLayout) => EditorLayout,
): void {
  current = update(getSnapshot());
  writeLayout(storage, current);
  for (const listener of listeners) listener();
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

const subscribeNever = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
