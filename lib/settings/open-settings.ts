export const SETTINGS_TABS = [
  "appearance",
  "profile",
  "account",
  "notifications",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

// The dialog lives in the sidebar; any client component (e.g. "Edit profile") opens it here.
const OPEN_EVENT = "story-app:open-settings";

export function openSettings(tab: SettingsTab = "appearance"): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tab }));
}

export function onOpenSettings(handler: (tab: SettingsTab) => void) {
  function listener(event: Event) {
    handler((event as CustomEvent<SettingsTab>).detail);
  }
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
