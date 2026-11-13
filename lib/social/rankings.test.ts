import { describe, expect, it } from "vitest";
import {
  bayesianAverage,
  isRankingStale,
  MIN_RATINGS,
  RANKING_MAX_AGE_MS,
  rankTopRated,
} from "./rankings";

describe("bayesianAverage", () => {
  it("pulls a mean towards the global one with the weight of m ratings", () => {
    // (3 * 5 + 5 * 5) / (5 + 5)
    expect(bayesianAverage(25, 5, 3)).toBe(4);
    expect(bayesianAverage(50, 10, 3)).toBeCloseTo((15 + 50) / 15);
  });

  it("is the global mean without ratings", () => {
    expect(bayesianAverage(0, 0, 3.5)).toBe(3.5);
  });
});

describe("rankTopRated", () => {
  it(`ranks only books with at least ${MIN_RATINGS} ratings`, () => {
    const ranked = rankTopRated([
      { folderId: "a", count: 5, sum: 20 },
      { folderId: "b", count: 4, sum: 20 },
    ]);
    expect(ranked.map(({ folderId }) => folderId)).toEqual(["a"]);
  });

  it("takes the global mean from every book, also below the threshold", () => {
    const [book] = rankTopRated([
      { folderId: "a", count: 5, sum: 25 },
      { folderId: "b", count: 5, sum: 5 },
    ]);
    // C = 30 / 10 = 3
    expect(book).toEqual({ folderId: "a", score: 4 });
  });

  it("puts many good ratings above a few perfect ones", () => {
    const ranked = rankTopRated([
      { folderId: "few", count: 5, sum: 25 },
      { folderId: "many", count: 100, sum: 480 },
      { folderId: "low", count: 20, sum: 40 },
    ]);
    expect(ranked.map(({ folderId }) => folderId)).toEqual([
      "many",
      "few",
      "low",
    ]);
  });

  it("orders equal scores by id and returns nothing without ratings", () => {
    const ranked = rankTopRated([
      { folderId: "b", count: 5, sum: 20 },
      { folderId: "a", count: 5, sum: 20 },
    ]);
    expect(ranked.map(({ folderId }) => folderId)).toEqual(["a", "b"]);
    expect(rankTopRated([])).toEqual([]);
  });
});

describe("isRankingStale", () => {
  it("is stale from an hour on", () => {
    const at = new Date("2026-11-11T10:00:00Z");
    const later = (ms: number) => new Date(at.getTime() + ms);
    expect(isRankingStale(at, later(RANKING_MAX_AGE_MS - 1))).toBe(false);
    expect(isRankingStale(at, later(RANKING_MAX_AGE_MS))).toBe(true);
  });
});
