import { describe, expect, it } from "vitest";
import {
  consonantRuns,
  EN_DIGRAPHS,
  PL_DIGRAPHS,
  syllableCount,
  tokenize,
} from "./phonemes";

const texts = (word: string, digraphs: string[]) =>
  tokenize(word, digraphs).map((p) => p.text);

describe("tokenize", () => {
  it("joins Polish digraphs", () => {
    expect(texts("Szczerz", PL_DIGRAPHS)).toEqual(["sz", "cz", "e", "rz"]);
  });

  it("joins English digraphs", () => {
    expect(texts("Thorn", EN_DIGRAPHS)).toEqual(["th", "o", "r", "n"]);
    expect(texts("Shire", EN_DIGRAPHS)).toEqual(["sh", "i", "r", "e"]);
  });

  it("uses the digraphs of the style only", () => {
    expect(texts("Merz", EN_DIGRAPHS)).toEqual(["m", "e", "r", "z"]);
  });

  it("skips what is not a letter", () => {
    expect(texts("K'a-7", EN_DIGRAPHS)).toEqual(["k", "a"]);
  });

  it("treats y before a vowel as a consonant", () => {
    const [y] = tokenize("Yara", EN_DIGRAPHS);
    expect(y.vowel).toBe(false);
    expect(tokenize("Lyra", EN_DIGRAPHS)[1].vowel).toBe(true);
  });
});

describe("counts", () => {
  it("counts a group of vowels as one syllable", () => {
    expect(syllableCount(tokenize("Maera", EN_DIGRAPHS))).toBe(2);
  });

  it("finds consonant runs", () => {
    expect(consonantRuns(tokenize("Astrid", EN_DIGRAPHS))).toEqual([
      ["s", "t", "r"],
      ["d"],
    ]);
  });
});
