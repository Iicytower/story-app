import { describe, expect, it } from "vitest";
import {
  cleanSense,
  type Entry,
  finishWord,
  parseEntry,
  type Sense,
} from "./wiktionary-import";

const line = (entry: object) => JSON.stringify(entry);

const sense = (gloss: string, extra: Partial<Sense> = {}): Sense => ({
  index: "1.1",
  gloss,
  labels: [],
  examples: [],
  ...extra,
});

describe("parseEntry", () => {
  it("keeps Polish entries with the part of speech, numbers and examples", () => {
    expect(
      parseEntry(
        line({
          word: "kot",
          lang_code: "pl",
          pos: "noun",
          pos_title: "rzeczownik",
          senses: [
            {
              glosses: ["Felis catus Linnaeus, zwierzę domowe"],
              topics: ["zoology"],
              sense_index: "1.1",
              examples: [
                { text: "Kot goni za myszą.", bold_text_offsets: [[0, 3]] },
              ],
            },
            {
              glosses: ["kłąb kurzu"],
              tags: ["colloquial", "masculine"],
              sense_index: "1.4",
              examples: [{ text: "a" }, { text: " b  c " }, { text: "d" }],
            },
          ],
          translations: [{ lang_code: "en", word: "cat" }],
        }),
      ),
    ).toEqual({
      word: "kot",
      entry: {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [
          {
            index: "1.1",
            gloss: "Felis catus Linnaeus, zwierzę domowe",
            labels: [],
            examples: ["Kot goni za myszą."],
          },
          {
            index: "1.4",
            gloss: "kłąb kurzu",
            labels: ["colloquial"],
            examples: ["a", "b c"],
          },
        ],
      },
    });
  });

  it("leaves out other languages and entries without a meaning", () => {
    const senses = [{ glosses: ["cat"], sense_index: "1.1" }];
    expect(
      parseEntry(
        line({
          word: "kot",
          lang_code: "cs",
          pos: "noun",
          posTitle: "rzeczownik",
          senses,
        }),
      ),
    ).toBeNull();
    expect(
      parseEntry(line({ word: "kot", lang_code: "pl", pos: "noun" })),
    ).toBeNull();
    expect(
      parseEntry(
        line({
          word: "kot",
          lang_code: "pl",
          senses: [{ glosses: [" "] }, { tags: ["obsolete"] }],
        }),
      ),
    ).toBeNull();
  });

  it("normalises the headword to NFC", () => {
    const parsed = parseEntry(
      line({
        word: "żółw",
        lang_code: "pl",
        pos: "noun",
        senses: [{ glosses: ["gad"], sense_index: "1.1" }],
      }),
    );
    expect(parsed?.word).toBe("żółw");
  });
});

describe("cleanSense", () => {
  it.each([
    ["gw. (Bukowina) targ", "dialectal", "Bukowina", "targ"],
    [
      "gw. (Śląsk Cieszyński i Górny Śląsk) zawias",
      "dialectal",
      "Śląsk Cieszyński i Górny Śląsk",
      "zawias",
    ],
    ["reg. (Poznań) żwir", "regional", "Poznań", "żwir"],
  ])("moves the label of %j out of the text", (gloss, label, region, text) => {
    expect(cleanSense({ glosses: [gloss], sense_index: "1.6" })).toEqual({
      index: "1.6",
      gloss: text,
      labels: [label],
      region,
      examples: [],
    });
  });

  it("does not take a duplicate label from the tags", () => {
    expect(
      cleanSense({
        glosses: ["gw. (Warszawa) ocena niedostateczna"],
        tags: ["dialectal", "obsolete"],
      })?.labels,
    ).toEqual(["obsolete", "dialectal"]);
  });

  it("leaves other abbreviations in the text", () => {
    expect(cleanSense({ glosses: ["rzecz. odczas. od bekać"] })?.gloss).toBe(
      "rzecz. odczas. od bekać",
    );
    expect(cleanSense({ glosses: ["zob. czytać"] })?.gloss).toBe("zob. czytać");
  });
});

describe("finishWord", () => {
  const meaning = sense("budynek warowny");

  it.each([
    "lm od: lut",
    "aspekt dokonany od: odczytywać",
    "od: ten",
    "zdrobn. od: sak",
  ])("drops the reference %j when the headword has meanings", (gloss) => {
    const entries: Entry[] = [
      {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [meaning, sense(gloss, { index: "1.2" })],
      },
      {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [sense(gloss, { index: "2.1" })],
      },
    ];
    expect(finishWord(entries)).toEqual([
      { pos: "noun", posTitle: "rzeczownik", senses: [meaning] },
    ]);
  });

  it("keeps references when there is nothing else", () => {
    const entries: Entry[] = [
      {
        pos: "pron",
        posTitle: "zaimek",
        senses: [sense("od: ten"), sense("nmos lm od: ta, to")],
      },
    ];
    expect(finishWord(entries)).toEqual([
      {
        pos: "pron",
        posTitle: "zaimek",
        senses: [
          sense("od: ten", { reference: true }),
          sense("nmos lm od: ta, to", { reference: true }),
        ],
      },
    ]);
  });

  it("does not take a gloss with “od” inside for a reference", () => {
    const entries: Entry[] = [
      {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [sense("rzecz. odczas. od bekać")],
      },
      {
        pos: "adj",
        posTitle: "przymiotnik",
        senses: [sense("najważniejszy, od którego: wszystko")],
      },
    ];
    expect(finishWord(entries)).toEqual(entries);
  });

  it("puts dialectal and regional senses after the general ones", () => {
    const dialect = sense("targ", {
      index: "1.2",
      labels: ["dialectal"],
      region: "Bukowina",
    });
    const regional = sense("żwir", {
      index: "1.3",
      labels: ["regional"],
      region: "Poznań",
    });
    const general = sense("miejsce", { index: "1.4" });
    expect(
      finishWord([
        {
          pos: "noun",
          posTitle: "rzeczownik",
          senses: [dialect, regional, general],
        },
      ]),
    ).toEqual([
      {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [general, dialect, regional],
      },
    ]);
  });
});
