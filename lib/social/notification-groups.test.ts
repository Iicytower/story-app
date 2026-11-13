import { describe, expect, it } from "vitest";
import { groupByDay } from "./notification-groups";

const at = (...parts: [number, number, number, number, number]) => ({
  updatedAt: new Date(...parts).toISOString(),
});

describe("groupByDay", () => {
  const now = new Date(2026, 10, 12, 9, 30);

  it("splits by the local calendar day, keeping the order", () => {
    const a = at(2026, 10, 12, 9, 0);
    const b = at(2026, 10, 12, 0, 5);
    const c = at(2026, 10, 11, 23, 55);
    const d = at(2025, 10, 12, 9, 0);
    expect(groupByDay([a, b, c, d], now)).toEqual([
      { group: "today", items: [a, b] },
      { group: "earlier", items: [c, d] },
    ]);
  });

  it("leaves out an empty group", () => {
    const old = at(2026, 9, 1, 12, 0);
    expect(groupByDay([old], now)).toEqual([
      { group: "earlier", items: [old] },
    ]);
    expect(groupByDay([], now)).toEqual([]);
  });
});
