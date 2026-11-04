import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENTS } from "@/lib/settings/settings";

type Oklch = [number, number, number];

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

// Every block that defines a palette: selector → variables.
const palettes = [...css.matchAll(/([^{}]+)\{([^{}]*--background:[^{}]*)\}/g)]
  .filter(([, selector]) => !selector.includes("@theme"))
  .map(([, selector, body]) => ({
    selector: selector.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    vars: Object.fromEntries(
      [
        ...body.matchAll(/--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g),
      ].map(([, name, l, c, h]) => [name, [+l, +c, +h] as Oklch]),
    ),
  }));

// OKLCH → linear sRGB (Björn Ottosson), clipped to the gamut.
function linearRgb([l, c, h]: Oklch): number[] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

function luminance(color: Oklch): number {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(x: Oklch, y: Oklch): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// Text on background, as the components pair them.
const TEXT_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "sidebar"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["foreground", "highlight"],
  ["foreground", "highlight-current"],
  ["foreground", "comment"],
  ["diff-added-foreground", "diff-added"],
  ["diff-removed-foreground", "diff-removed"],
];

describe("color palettes in globals.css", () => {
  it("has a light and a dark palette for every accent", () => {
    for (const accent of ACCENTS) {
      const selectors = palettes.filter((p) =>
        p.selector.includes(`[data-accent="${accent}"]`),
      );
      expect(selectors.map((p) => p.selector.startsWith(".dark"))).toEqual([
        false,
        true,
      ]);
    }
    expect(palettes).toHaveLength(ACCENTS.length * 2);
  });

  describe.each(palettes)("$selector", ({ vars }) => {
    it.each(TEXT_PAIRS)("%s on %s meets WCAG AA", (text, background) => {
      expect(vars[text], text).toBeDefined();
      expect(vars[background], background).toBeDefined();
      expect(contrast(vars[text], vars[background])).toBeGreaterThanOrEqual(
        4.5,
      );
    });

    it("has neither a pure white nor a pure black background or text", () => {
      for (const name of ["background", "foreground"]) {
        const value = luminance(vars[name]);
        expect(value, name).toBeGreaterThan(0.005);
        expect(value, name).toBeLessThan(0.95);
      }
    });
  });
});
