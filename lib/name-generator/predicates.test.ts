import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type Filters } from "./filters";
import { EN_DIGRAPHS, PL_DIGRAPHS, tokenize } from "./phonemes";
import {
  balanceClass,
  hasRepeatedSyllable,
  isEasyToInflect,
  lengthClass,
  matchesFilters,
  pronunciationClass,
  significantWords,
  soundClass,
} from "./predicates";

const en = (word: string) => tokenize(word, EN_DIGRAPHS);
const pl = (word: string) => tokenize(word, PL_DIGRAPHS);

describe("sound", () => {
  it("classifies by the share of hard and soft consonants", () => {
    expect(soundClass([en("Krag")])).toBe("hard");
    expect(soundClass([en("Lilien")])).toBe("soft");
  });

  it("is neutral at an even split and between the thresholds", () => {
    expect(soundClass([en("Kala")])).toBe("neutral");
    expect(soundClass([en("Kadatalan")])).toBe("neutral");
  });

  it("reaches the thresholds at one third", () => {
    expect(soundClass([en("Kadala")])).toBe("hard");
    expect(soundClass([en("Kalan")])).toBe("soft");
  });

  it("is neutral without hard and soft consonants", () => {
    expect(soundClass([en("Aia")])).toBe("neutral");
  });
});

describe("length", () => {
  it.each([
    ["Kal", "short"],
    ["Kala", "short"],
    ["Kalamo", "medium"],
    ["Kalamora", "long"],
  ])("%s is %s", (word, expected) => {
    expect(lengthClass(en(word))).toBe(expected);
  });
});

describe("pronunciation", () => {
  it("is easy with known clusters and at most two vowels in a row", () => {
    expect(pronunciationClass(en("Astra"), ["latin"])).toBe("exotic");
    expect(pronunciationClass(en("Stara"), ["latin"])).toBe("easy");
    expect(pronunciationClass(en("Maera"), ["latin"])).toBe("easy");
  });

  it("does not count three vowels in a row as easy", () => {
    expect(pronunciationClass(en("Maiera"), ["latin"])).toBe("plain");
  });

  it("is exotic with a cluster the style does not know", () => {
    expect(pronunciationClass(en("Kazgrat"), ["latin"])).toBe("exotic");
  });

  it("is unpronounceable with four consonants or no vowel", () => {
    expect(pronunciationClass(en("Kalmgrat"), ["latin"])).toBe(
      "unpronounceable",
    );
    expect(pronunciationClass(en("Krt"), ["latin"])).toBe("unpronounceable");
  });

  it("counts a digraph as one sound", () => {
    expect(pronunciationClass(pl("Szczur"), ["polish"])).not.toBe(
      "unpronounceable",
    );
  });
});

describe("letter balance", () => {
  it("uses the 55% and 35% limits", () => {
    expect(balanceClass([en("Aelia")])).toBe("vowel-heavy");
    expect(balanceClass([en("Kalam")])).toBe("balanced");
    expect(balanceClass([en("Karst")])).toBe("consonant-heavy");
  });
});

describe("repeated syllable", () => {
  it("finds a doubled syllable", () => {
    expect(hasRepeatedSyllable(en("Lulu"))).toBe(true);
    expect(hasRepeatedSyllable(en("Bobon"))).toBe(true);
    expect(hasRepeatedSyllable(en("Lula"))).toBe(false);
  });
});

describe("easy to inflect", () => {
  it.each([
    ["Kalin", true],
    ["Marta", true],
    ["Kaldr", false],
    ["Alia", false],
    ["Tomi", false],
    ["Vex-7", false],
  ])("%s: %s", (word, expected) => {
    expect(isEasyToInflect(word)).toBe(expected);
  });
});

describe("matchesFilters", () => {
  const name = (text: string) => ({ text, origins: ["english" as const] });
  const allow: Filters = { ...DEFAULT_FILTERS, crude: "allow", type: "city" };

  it("ignores words around the root", () => {
    expect(significantWords("Order of the Silver Sun")).toEqual([
      "Silver",
      "Sun",
    ]);
  });

  it("compares text filters without case", () => {
    expect(matchesFilters(name("Kalmar"), { ...allow, startsWith: "KA" })).toBe(
      true,
    );
    expect(matchesFilters(name("Kalmar"), { ...allow, endsWith: "AR" })).toBe(
      true,
    );
    expect(matchesFilters(name("Kalmar"), { ...allow, contains: "LM" })).toBe(
      true,
    );
    expect(
      matchesFilters(name("Kalmar"), { ...allow, excludes: "x, ALM" }),
    ).toBe(false);
  });

  it("rejects Polish letters when they are switched off", () => {
    expect(matchesFilters(name("Żar"), allow)).toBe(true);
    expect(
      matchesFilters(name("Żar"), { ...allow, polishLetters: false }),
    ).toBe(false);
  });

  it("allows digits in Sci-fi only", () => {
    const filters = { ...allow, punctuation: true };
    expect(matchesFilters(name("Vex-7"), filters)).toBe(false);
    expect(matchesFilters({ text: "Vex-7", origins: ["scifi"] }, filters)).toBe(
      true,
    );
  });
});
