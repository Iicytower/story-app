import { describe, expect, it } from "vitest";
import { mulberry32, pick, pickWeighted } from "./rng";

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives a different sequence for another seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("stays within 0 and 1", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("pick", () => {
  it("takes an element of the list", () => {
    expect(["a", "b"]).toContain(pick(mulberry32(3), ["a", "b"]));
  });

  it("never takes an element with weight 0", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 100; i += 1) {
      expect(pickWeighted(rng, ["a", "b"], (x) => (x === "a" ? 1 : 0))).toBe(
        "a",
      );
    }
  });
});
