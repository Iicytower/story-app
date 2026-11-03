import { describe, expect, it } from "vitest";
import { containsCrude, normalizeCrude } from "./crude";
import { CRUDE_ROOTS } from "./data/crude-roots";

describe("normalizeCrude", () => {
  it("applies phonetic rules before removing diacritics", () => {
    expect(normalizeCrude("Kórwa")).toBe("kurwa");
    expect(normalizeCrude("rzeka")).toBe("zeka");
    expect(normalizeCrude("chuj")).toBe("huj");
    expect(normalizeCrude("khui")).toBe("hui");
    expect(normalizeCrude("blyat")).toBe("bljat");
  });

  it("removes doubled letters", () => {
    expect(normalizeCrude("Fuuuck")).toBe("fuck");
  });
});

describe("containsCrude", () => {
  it.each(CRUDE_ROOTS)("finds the root %s", (root) => {
    expect(containsCrude(root)).toBe(true);
  });

  it.each([
    "huj",
    "chuj",
    "kórwa",
    "kurva",
    "blyat",
    "bljat",
    "khui",
    "hui",
    "Pizdets",
  ])("finds the variant %s", (word) => {
    expect(containsCrude(word)).toBe(true);
  });

  it("finds a root inside a name, in any case", () => {
    expect(containsCrude("Malkurwon")).toBe(true);
    expect(containsCrude("BALFUCKOR")).toBe(true);
  });

  it("finds a root split by punctuation", () => {
    expect(containsCrude("Ku'rwa")).toBe(true);
  });

  it("finds roots of 4+ letters one edit away", () => {
    expect(containsCrude("Fuk")).toBe(true);
    expect(containsCrude("Shyt")).toBe(true);
  });

  it("does not fuzzy-match roots of 3 letters", () => {
    expect(containsCrude("Hut")).toBe(false);
  });

  it("does not flag names from the exception list", () => {
    expect(containsCrude("Stonedock")).toBe(false);
    expect(containsCrude("Shipwright")).toBe(false);
  });

  it("does not flag plain names", () => {
    expect(containsCrude("Kalmar")).toBe(false);
    expect(containsCrude("Aelindor")).toBe(false);
  });
});
