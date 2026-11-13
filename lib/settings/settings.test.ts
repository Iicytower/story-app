import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import { OPTIONAL_NOTIFICATION_TYPES } from "@/lib/social/notifications";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsPatch,
  settingsUpdate,
} from "./settings";

const ALL_NOTIFICATIONS = Object.fromEntries(
  OPTIONAL_NOTIFICATION_TYPES.map((type) => [type, true]),
);

describe("DEFAULT_SETTINGS", () => {
  it("groups the defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      editor: { layout: DEFAULT_LAYOUT, mobileView: "story" },
      appearance: {
        sidebarCollapsed: false,
        editorSidebarCollapsed: true,
        theme: null,
        accent: "sepia",
        locale: null,
      },
      folders: { sort: "updated", manualOrder: false },
      proofreading: { dictionary: [] },
      messages: { dmFrom: "everyone" },
      notifications: ALL_NOTIFICATIONS,
    });
  });
});

describe("normalizeSettings", () => {
  it("returns the defaults when nothing is stored", () => {
    for (const data of [undefined, null, "dark", [], { editor: "wide" }]) {
      expect(normalizeSettings(data)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("falls back field by field and ignores unknown fields", () => {
    expect(
      normalizeSettings({
        userId: "x",
        appearance: { theme: "dark" },
        editor: {
          mobileView: "preview",
          layout: { tab: 3, collapsed: { tools: true } },
        },
        folders: { sort: "alpha", manualOrder: "yes" },
        proofreading: {
          dictionary: [" Ania ", "Ania", 3, "dwa słowa", "Kwak"],
        },
        notifications: { comment: false, rating: "no", ban: false },
        messages: { dmFrom: "friends" },
        other: { a: 1 },
      }),
    ).toEqual({
      editor: {
        layout: {
          ...DEFAULT_LAYOUT,
          collapsed: { notes: false, chapters: false, tools: true },
        },
        mobileView: "story",
      },
      appearance: {
        sidebarCollapsed: false,
        editorSidebarCollapsed: true,
        theme: "dark",
        accent: "sepia",
        locale: null,
      },
      folders: { sort: "alpha", manualOrder: false },
      proofreading: { dictionary: ["Ania", "Kwak"] },
      messages: { dmFrom: "everyone" },
      notifications: { ...ALL_NOTIFICATIONS, comment: false },
    });
    expect(
      normalizeSettings({
        appearance: { theme: "blue" },
        folders: { manualOrder: true },
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      folders: { sort: "updated", manualOrder: true },
    });
  });
});

describe("parseSettingsPatch", () => {
  it("keeps the fields sent", () => {
    expect(parseSettingsPatch({ appearance: { theme: "light" } })).toEqual({
      appearance: { theme: "light" },
    });
    expect(parseSettingsPatch({ appearance: { theme: null } })).toEqual({
      appearance: { theme: null },
    });
    expect(
      parseSettingsPatch({
        editor: { mobileView: "chapters" },
        appearance: { theme: "dark" },
      }),
    ).toEqual({
      editor: { mobileView: "chapters" },
      appearance: { theme: "dark" },
    });
    expect(parseSettingsPatch({ editor: { mobileView: "tools" } })).toEqual({
      editor: { mobileView: "tools" },
    });
    expect(parseSettingsPatch({ notifications: { reaction: false } })).toEqual({
      notifications: { reaction: false },
    });
    expect(parseSettingsPatch({ messages: { dmFrom: "following" } })).toEqual({
      messages: { dmFrom: "following" },
    });
    expect(parseSettingsPatch({ messages: { dmFrom: "friends" } })).toBeNull();
  });

  it("normalizes the layout like stored data", () => {
    expect(
      parseSettingsPatch({
        editor: { layout: { tab: "tools", widths: { x: {} } } },
      }),
    ).toEqual({ editor: { layout: { ...DEFAULT_LAYOUT, tab: "tools" } } });
  });

  it("rejects invalid values, unknown fields, folder settings and an empty patch", () => {
    for (const data of [
      { appearance: { theme: "blue" } },
      { editor: { mobileView: "preview" }, appearance: { theme: "dark" } },
      { editor: { mobileView: "notes", width: 3 } },
      { other: { a: 1 } },
      { editor: "wide" },
      { folders: { sort: "alpha" } },
      { folders: { manualOrder: true } },
      { proofreading: { dictionary: ["Ania"] } },
      { editor: { toString: "x" } },
      // Moderation notifications have no switch (D80).
      { notifications: { ban: false } },
      { notifications: { comment: "off" } },
      {},
      { editor: {} },
      null,
      "dark",
    ]) {
      expect(parseSettingsPatch(data), JSON.stringify(data)).toBeNull();
    }
  });
});

describe("settingsUpdate", () => {
  it("sets each field by its path", () => {
    expect(
      settingsUpdate({
        editor: { mobileView: "notes" },
        appearance: { theme: null },
      }),
    ).toEqual({ "editor.mobileView": "notes", "appearance.theme": null });
  });
});
