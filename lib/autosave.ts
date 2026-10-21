export const AUTOSAVE_DELAY_MS = 20_000;

// Saves as soon as the tab is hidden, so the long delay does not lose text when switching away.
export function onTabHidden(save: () => void): () => void {
  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") save();
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}
