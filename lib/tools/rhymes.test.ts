import { describe, expect, it } from "vitest";
import { ToolsError } from "./client";
import { rhymeKeys } from "./rhyme-key";
import {
  COMMON_FREQUENCY,
  isFiltered,
  MAX_MORE,
  MAX_SHOWN,
  NO_FILTERS,
  parseRhymeFilters,
  rankRhymes,
} from "./rhymes";
import { FUNCTION_WORD, GRAMMATICAL, VERBAL } from "./rhymes-import";

const COMMON = COMMON_FREQUENCY + 100;
const RARE = COMMON_FREQUENCY - 1;

// A row as the service gives it; phones and keys from the real transcription.
function row(form: string, lemmas: string, freq = COMMON, flags = 0) {
  const { phones } = rhymeKeys(form)!;
  return { form, phones, freq, lemmas, flags };
}
function self(form: string, lemmas: string, flags = 0) {
  const { phones, exact, near, last } = rhymeKeys(form)!;
  return { form, phones, exact, near, last, freq: COMMON, lemmas, flags };
}

const answer = (
  rows: Partial<Record<"self" | "exact" | "near" | "last", unknown[]>>,
) => ({ source: "rhymes", self: [], exact: [], near: [], last: [], ...rows });

const rank = (word: string, response: unknown) =>
  rankRhymes(word, rhymeKeys(word)!, response);

describe("rankRhymes", () => {
  it("orders by the longest common ending, then by frequency", () => {
    const result = rank(
      "kota",
      answer({
        self: [self("kota", "1,2")],
        exact: [
          row("złota", "10", COMMON + 50),
          row("robota", "11", COMMON + 40),
          row("idiota", "12", COMMON + 30),
          // "Qota" shares four phones (q is k), the others three.
          row("Qota", "13", COMMON),
        ],
        near: [row("woda", "20")],
        last: [row("lata", "30")],
      }),
    );
    expect(result).toEqual({
      groups: [
        {
          level: "exact",
          words: ["Qota", "złota", "robota", "idiota"],
          more: [],
        },
        { level: "near", words: ["woda"], more: [] },
        { level: "last", words: ["lata"], more: [] },
      ],
      sources: ["polimorf", "wordfreq"],
      filters: NO_FILTERS,
    });
  });

  it("leaves out the word, its lemmas and words of one stem (criterion 3)", () => {
    const { groups } = rank(
      "pisanie",
      answer({
        self: [self("pisanie", "1,2", VERBAL)],
        exact: [
          row("pisanie", "1,2"),
          // Another form of the same lemma.
          row("Pisanie", "2"),
          row("napisanie", "3"),
          row("przepisanie", "4"),
          row("granie", "5"),
        ],
        last: [row("nie", "6", COMMON, FUNCTION_WORD), row("panie", "7")],
      }),
    );
    expect(groups).toEqual([
      { level: "exact", words: ["granie"], more: [] },
      { level: "last", words: ["panie"], more: ["nie"] },
    ]);
  });

  it("drops the word with a prefix either way, but not another word ending in it (criterion 3)", () => {
    expect(
      rank(
        "przelot",
        answer({
          last: [
            row("lot", "1"),
            row("nalot", "2"),
            row("samolot", "3"),
            row("kot", "4"),
          ],
        }),
      ).groups,
    ).toEqual([
      { level: "last", words: ["nalot", "samolot", "kot"], more: [] },
    ]);
    expect(
      rank(
        "ma",
        answer({
          last: [row("mama", "1"), row("zima", "2"), row("nadma", "3")],
        }),
      ).groups,
    ).toEqual([{ level: "last", words: ["mama", "zima"], more: [] }]);
  });

  it("shows function words only under Show more (criterion 4)", () => {
    const { groups } = rank(
      "kawie",
      answer({
        self: [self("kawie", "1")],
        last: [
          row("nie", "2", 900, FUNCTION_WORD),
          row("się", "3", 890, FUNCTION_WORD),
          row("że", "4", 880, FUNCTION_WORD),
          row("ale", "5", 870, FUNCTION_WORD),
          row("prawie", "6", COMMON),
        ],
      }),
    );
    expect(groups).toEqual([
      {
        level: "last",
        words: ["prawie"],
        more: ["nie", "się", "że", "ale"],
      },
    ]);
  });

  it("puts grammatical rhymes of kochanie under Show more (criterion 5)", () => {
    const { groups } = rank(
      "kochanie",
      answer({
        self: [self("kochanie", "1,2", VERBAL)],
        exact: [
          // Gerunds and nouns of verbs that rhyme on -anie only.
          row("czytanie", "3", 600, GRAMMATICAL | VERBAL),
          row("pytanie", "4", 550, VERBAL),
          row("zadanie", "5", 540, VERBAL),
          // Nouns.
          row("panie", "6", 500),
          row("ścianie", "7", 450),
          // A longer common ending is a rhyme of its own.
          row("przesłuchanie", "8", 400, VERBAL),
        ],
      }),
    );
    expect(groups).toEqual([
      {
        level: "exact",
        words: ["przesłuchanie", "panie", "ścianie"],
        more: ["czytanie", "pytanie", "zadanie"],
      },
    ]);
  });

  it("keeps verbal rhymes of a word that is not verbal", () => {
    expect(
      rank(
        "otchłanie",
        answer({ exact: [row("pytanie", "4", COMMON, VERBAL)] }),
      ).groups[0].words,
    ).toEqual(["pytanie"]);
  });

  it("rhymes an inflected form as typed (criterion 6)", () => {
    // The row of "kota" brings its phones: "Qota" shares more with it than "lota".
    const { groups } = rank(
      "kota",
      answer({
        self: [self("kota", "1,2")],
        exact: [row("lota", "3", COMMON + 1), row("Qota", "4")],
      }),
    );
    expect(groups[0].words).toEqual(["Qota", "lota"]);
  });

  it("uses the sent keys for a word not in the table", () => {
    expect(
      rankRhymes(
        "kotabla",
        rhymeKeys("kotabla")!,
        answer({ exact: [row("tabla", "1"), row("grabla", "2")] }),
      ).groups[0].words,
    ).toEqual(["tabla", "grabla"]);
  });

  it("puts rare words under Show more", () => {
    expect(
      rank("kot", answer({ exact: [row("płot", "1", RARE), row("lot", "2")] }))
        .groups,
    ).toEqual([{ level: "exact", words: ["lot"], more: ["płot"] }]);
  });

  it("shows at most two forms of a lemma", () => {
    expect(
      rank(
        "ryby",
        answer({
          exact: [row("szyby", "1"), row("grzyby", "2"), row("niby", "3")],
          near: [row("szybę", "1"), row("szyba", "1"), row("grzybem", "2")],
        }),
      ).groups,
    ).toEqual([
      { level: "exact", words: ["szyby", "grzyby", "niby"], more: [] },
      { level: "near", words: ["szybę", "grzybem"], more: [] },
    ]);
  });

  it("shows a word at its best level only", () => {
    expect(
      rank("kot", answer({ exact: [row("lot", "1")], last: [row("lot", "1")] }))
        .groups,
    ).toEqual([{ level: "exact", words: ["lot"], more: [] }]);
  });

  it(`shows at most ${MAX_SHOWN} words and ${MAX_MORE} more`, () => {
    const rows = Array.from({ length: 200 }, (_, n) =>
      row(
        `k${"a".repeat(n % 5)}ot${String.fromCharCode(0x61 + (n % 26))}${n}`,
        String(n),
      ),
    );
    const [group] = rank("xyz", answer({ exact: rows })).groups;
    expect(group.words).toHaveLength(MAX_SHOWN);
    expect(group.more).toHaveLength(MAX_MORE);
  });

  it("gives no groups and no sources without rhymes", () => {
    expect(rank("xyzq", answer({}))).toEqual({
      groups: [],
      sources: [],
      filters: NO_FILTERS,
    });
  });

  it.each([
    ["another source", { ...answer({}), source: "polimorf" }],
    ["no level", { source: "rhymes", self: [], exact: [], near: [] }],
    [
      "a row without phones",
      answer({ exact: [{ form: "lot", freq: 1, lemmas: "", flags: 0 }] }),
    ],
    ["a spelling row without keys", answer({ self: [row("kot", "1")] })],
    [
      "a fractional frequency",
      answer({ near: [{ ...row("lot", "1"), freq: 1.5 }] }),
    ],
  ])("takes %s for a broken answer", (_, response) => {
    expect(() => rank("kot", response)).toThrow(ToolsError);
  });
});

describe("parseRhymeFilters", () => {
  it.each([
    [NO_FILTERS, NO_FILTERS],
    [
      { pos: "verb", min: 2, max: 2 },
      { pos: "verb", min: 2, max: 2 },
    ],
    // Extra fields are dropped.
    [
      { pos: null, min: 1, max: 6, sql: "x" },
      { pos: null, min: 1, max: 6 },
    ],
    [{ pos: "toString", min: 1, max: 6 }, null],
    [{ pos: null, min: 4, max: 3 }, null],
    [{ pos: null, min: "1", max: 6 }, null],
    [{ pos: null, min: 1 }, null],
    [undefined, null],
  ])("%j → %j", (value, filters) => {
    expect(parseRhymeFilters(value)).toEqual(filters);
  });

  it("tells filters that narrow from none", () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, pos: "noun" })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, min: 2 })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, max: 5 })).toBe(true);
  });
});
