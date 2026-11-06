import { describe, expect, it } from "vitest";
import { ToolsError } from "./client";
import { lookupForms, parseLookupWord, rankLemmas } from "./dictionary";

describe("parseLookupWord", () => {
  it("takes one trimmed word in NFC", () => {
    expect(parseLookupWord("  kota ")).toBe("kota");
    expect(parseLookupWord("żółw")).toBe("żółw");
    expect(parseLookupWord("o’clock")).toBe("o'clock");
  });

  it.each(["", "  ", "dwa słowa", "x".repeat(51), 3, null, ["kot"]])(
    "rejects %j",
    (value) => {
      expect(parseLookupWord(value)).toBeNull();
    },
  );
});

describe("lookupForms", () => {
  it("sends the word as typed, in lower case, capitalised and in capitals", () => {
    expect(lookupForms("kota")).toEqual(["kota", "Kota", "KOTA"]);
    expect(lookupForms("Kota")).toEqual(["Kota", "kota", "KOTA"]);
    expect(lookupForms("ŁÓDŹ")).toEqual(["ŁÓDŹ", "łódź", "Łódź"]);
    expect(lookupForms("iPhone")).toEqual([
      "iPhone",
      "iphone",
      "Iphone",
      "IPHONE",
    ]);
  });

  it("leaves out spellings longer than the service takes", () => {
    // "ß" is "SS" in capitals, so both upper-case spellings have 51 characters.
    const word = "ß" + "a".repeat(49);
    expect(lookupForms(word)).toEqual([word]);
  });
});

describe("rankLemmas", () => {
  const rows = [
    { form: "Kota", lemma: "Kot" },
    { form: "kota", lemma: "kot" },
    { form: "kota", lemma: "kota" },
  ];

  it("lists every lemma once, those of the exact form first, with the source", () => {
    expect(rankLemmas("kota", { source: "polimorf", rows })).toEqual([
      { lemma: "kot", source: "polimorf" },
      { lemma: "kota", source: "polimorf" },
      { lemma: "Kot", source: "polimorf" },
    ]);
    expect(
      rankLemmas("Kota", { source: "polimorf", rows }).map(
        ({ lemma }) => lemma,
      ),
    ).toEqual(["Kot", "kot", "kota"]);
    expect(
      rankLemmas("zamku", {
        source: "polimorf",
        rows: [
          { form: "zamku", lemma: "zamek" },
          { form: "Zamku", lemma: "Zamek" },
          { form: "zamku", lemma: "zamek" },
        ],
      }).map(({ lemma }) => lemma),
    ).toEqual(["zamek", "Zamek"]);
  });

  it("gives an empty list for an unknown word", () => {
    expect(rankLemmas("xyzq", { source: "polimorf", rows: [] })).toEqual([]);
  });

  it.each([
    null,
    "text",
    { rows },
    { source: "wikipedia", rows },
    { source: "polimorf" },
    { source: "polimorf", rows: [{ form: "kota" }] },
    { source: "polimorf", rows: [null] },
  ])("treats a malformed answer %j as an unavailable service", (response) => {
    expect(() => rankLemmas("kota", response)).toThrow(ToolsError);
  });
});
