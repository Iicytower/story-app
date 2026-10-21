import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsPatch,
  settingsUpdate,
} from "./settings";

describe("DEFAULT_SETTINGS", () => {
  it("groups the defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      editor: { layout: DEFAULT_LAYOUT, mobileView: "story" },
      appearance: { theme: null },
      folders: { sort: "updated", manualOrder: false },
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
        editor: { mobileView: "preview", layout: { split: true, tab: 3 } },
        folders: { sort: "alpha", manualOrder: "yes" },
        other: { a: 1 },
      }),
    ).toEqual({
      editor: {
        layout: { ...DEFAULT_LAYOUT, split: true },
        mobileView: "story",
      },
      appearance: { theme: "dark" },
      folders: { sort: "alpha", manualOrder: false },
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
  });

  it("normalizes the layout like stored data", () => {
    expect(
      parseSettingsPatch({
        editor: { layout: { split: true, widths: { x: {} } } },
      }),
    ).toEqual({ editor: { layout: { ...DEFAULT_LAYOUT, split: true } } });
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
      { editor: { toString: "x" } },
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
