import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|css)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

// Dialogs and panels only darken the page behind them (D83, 1.5).
describe("overlays", () => {
  it("never blur the background", () => {
    const blurred = [...sources("components"), ...sources("app")].filter(
      (file) =>
        !file.endsWith(".test.ts") &&
        /backdrop-blur/.test(readFileSync(file, "utf8")),
    );
    expect(blurred).toEqual([]);
  });
});
