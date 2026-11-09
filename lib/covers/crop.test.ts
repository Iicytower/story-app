import { describe, expect, it } from "vitest";
import { clampedCenter, cropRect, MAX_ZOOM } from "./crop";

describe("cropRect", () => {
  it("takes the full height of a wide image, centred", () => {
    expect(cropRect(1200, 900, 1, { x: 0, y: 0 })).toEqual({
      x: 300,
      y: 0,
      width: 600,
      height: 900,
    });
  });

  it("takes the full width of a tall image", () => {
    expect(cropRect(600, 1200, 1, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 150,
      width: 600,
      height: 900,
    });
  });

  it("zooms in around the centre and keeps the 2:3 ratio", () => {
    const rect = cropRect(1200, 900, 2, { x: 0, y: 0 });
    expect(rect).toEqual({ x: 450, y: 225, width: 300, height: 450 });
    expect(rect.width / rect.height).toBeCloseTo(2 / 3);
  });

  it("keeps the frame inside the image when moved past an edge", () => {
    const rect = cropRect(1200, 900, 1, { x: 10_000, y: -10_000 });
    expect(rect).toEqual({ x: 600, y: 0, width: 600, height: 900 });
    expect(clampedCenter(1200, 900, rect)).toEqual({ x: 300, y: 0 });
  });

  it("limits the zoom", () => {
    expect(cropRect(600, 900, 100, { x: 0, y: 0 }).width).toBe(600 / MAX_ZOOM);
    expect(cropRect(600, 900, 0.1, { x: 0, y: 0 }).width).toBe(600);
  });
});
