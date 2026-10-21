import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsPatch,
} from "./settings";

describe("normalizeSettings", () => {
  it("returns the defaults when nothing is stored", () => {
    for (const data of [undefined, null, "dark", []]) {
      expect(normalizeSettings(data)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("falls back field by field", () => {
    expect(
      normalizeSettings({
        theme: "dark",
        mobileView: "preview",
        editorLayout: { split: true, tab: 3 },
      }),
    ).toEqual({
      theme: "dark",
      mobileView: "story",
      editorLayout: { ...DEFAULT_LAYOUT, split: true },
    });
    expect(normalizeSettings({ theme: "blue", mobileView: "notes" })).toEqual(
      { ...DEFAULT_SETTINGS, mobileView: "notes" },
    );
  });
});

describe("parseSettingsPatch", () => {
  it("keeps only the fields sent", () => {
    expect(parseSettingsPatch({ theme: "light" })).toEqual({ theme: "light" });
    expect(parseSettingsPatch({ theme: null })).toEqual({ theme: null });
    expect(parseSettingsPatch({ mobileView: "chapters", other: 1 })).toEqual({
      mobileView: "chapters",
    });
  });

  it("normalizes the layout like stored data", () => {
    expect(
      parseSettingsPatch({ editorLayout: { split: true, widths: { x: {} } } }),
    ).toEqual({ editorLayout: { ...DEFAULT_LAYOUT, split: true } });
  });

  it("rejects an unknown theme or view and an empty patch", () => {
    for (const data of [
      { theme: "blue" },
      { mobileView: "preview", theme: "dark" },
      {},
      { other: 1 },
      null,
      "dark",
    ]) {
      expect(parseSettingsPatch(data)).toBeNull();
    }
  });
});
