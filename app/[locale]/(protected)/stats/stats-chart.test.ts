import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./stats-chart.tsx", import.meta.url)),
  "utf8",
);

// recharts animates series by default; the chart appears at once (D83, 5.3).
describe("stats chart", () => {
  it("turns the animation off on every series", () => {
    const series = source.match(/<(Bar|Line|Area)\b[^>]*>/g) ?? [];
    expect(series.length).toBeGreaterThan(0);
    for (const tag of series)
      expect(tag).toContain("isAnimationActive={false}");
  });
});
