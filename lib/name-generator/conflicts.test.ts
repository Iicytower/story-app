import { describe, expect, it } from "vitest";
import {
  clearedBy,
  clearsLabel,
  clearValue,
  CONFLICTS,
  selectValue,
} from "./conflicts";
import { DEFAULT_FILTERS } from "./filters";

describe("conflict list", () => {
  it("has no pair twice, in either order", () => {
    const pairs = CONFLICTS.map((pair) => [...pair].sort().join("|"));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("works both ways", () => {
    for (const [a, b] of CONFLICTS) {
      const first = selectValue(DEFAULT_FILTERS, a);
      expect(clearedBy(first, b)).toContain(a);
      const second = selectValue(DEFAULT_FILTERS, b);
      expect(clearedBy(second, a)).toContain(b);
    }
  });
});

describe("selectValue", () => {
  it("clears the value in the way and returns its group to Any", () => {
    const hard = selectValue(DEFAULT_FILTERS, "pronunciation:unpronounceable");
    const next = selectValue(hard, "balance:vowel-heavy");
    expect(next.pronunciation).toBe("any");
    expect(next.balance).toBe("vowel-heavy");
  });

  it("switches off a toggle in the way", () => {
    const on = selectValue(DEFAULT_FILTERS, "alliteration:on");
    expect(selectValue(on, "wordCount:one").alliteration).toBe(false);
  });

  it("clears only the conflicting style", () => {
    const both = selectValue(
      selectValue(DEFAULT_FILTERS, "style:elvish"),
      "style:latin",
    );
    expect(selectValue(both, "sound:hard").styles).toEqual(["latin"]);
  });

  it("returns styles to Any when none is left", () => {
    const one = selectValue(DEFAULT_FILTERS, "style:elvish");
    expect(selectValue(one, "sound:hard").styles).toEqual([]);
  });

  it("does not bring a cleared value back", () => {
    const one = selectValue(DEFAULT_FILTERS, "sound:hard");
    const two = selectValue(one, "style:elvish");
    expect(two.sound).toBe("any");
    expect(clearValue(two, "style:elvish").sound).toBe("any");
  });

  it("keeps Polish letters as an inverted toggle", () => {
    const off = selectValue(DEFAULT_FILTERS, "polishLetters:off");
    expect(off.polishLetters).toBe(false);
    expect(clearValue(off, "polishLetters:off").polishLetters).toBe(true);
  });
});

describe("clearsLabel", () => {
  it("names the selected values a click would clear", () => {
    const filters = selectValue(DEFAULT_FILTERS, "sound:hard");
    expect(clearsLabel(clearedBy(filters, "style:elvish"))).toBe("Clears Hard");
  });

  it("is empty when nothing would be cleared", () => {
    expect(clearsLabel(clearedBy(DEFAULT_FILTERS, "style:elvish"))).toBe(
      undefined,
    );
  });
});
