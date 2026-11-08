import { describe, expect, it } from "vitest";
import {
  cleanThesaurusWord,
  cleanWiktionarySynonym,
  decodeThesaurus,
  MAX_GLOSS,
  parseSynonymEntry,
  parseThesaurus,
  senseIndices,
  thesaurusLicence,
} from "./synonyms-import";
import { SOURCES } from "./sources";

const line = (entry: object) => JSON.stringify(entry);

describe("cleanWiktionarySynonym", () => {
  it("keeps only Wiktionary's own tags, not the thesaurus registers", () => {
    expect(
      cleanWiktionarySynonym({ word: "kot", tags: ["specialist", "rare"] }),
    ).toEqual([{ word: "kot", labels: ["rare"] }]);
  });

  it("keeps a plain word with the known tags", () => {
    expect(
      cleanWiktionarySynonym({
        word: " sierściuch ",
        tags: ["scornfully", "masculine"],
      }),
    ).toEqual([{ word: "sierściuch", labels: ["scornfully"] }]);
  });

  it("moves a dialect label and its region out of the word, splitting a list", () => {
    expect(
      cleanWiktionarySynonym({ word: "gw. (Górny Śląsk) jabko, płónka" }),
    ).toEqual([
      { word: "jabko", labels: ["dialectal"], region: "Górny Śląsk" },
      { word: "płónka", labels: ["dialectal"], region: "Górny Śląsk" },
    ]);
  });

  it.each([
    ["reg. pozn. kejter", "kejter", "regional", "Poznań"],
    ["sł. kres. morkwa", "morkwa", "regional", "Kresy"],
    ["gw. warsz. skowyr", "skowyr", "dialectal", "Warszawa"],
    ["reg. niezn. słowo", "słowo", "regional", "niezn."],
  ])("reads the abbreviated region of %j", (word, clean, label, region) => {
    expect(cleanWiktionarySynonym({ word })).toEqual([
      { word: clean, labels: [label], region },
    ]);
  });

  it.each([
    ["stpol. cieść", "cieść", ["obsolete"]],
    ["pot. bomba", "bomba", ["colloquial"]],
    ["wulg. pojebało kogoś", "pojebało kogoś", ["vulgar"]],
    ["neutr. bezład", "bezład", []],
  ])("turns the prefix of %j into a label", (word, clean, labels) => {
    expect(cleanWiktionarySynonym({ word })).toEqual([{ word: clean, labels }]);
  });

  it("keeps a proverb with commas and an abbreviation that is the word", () => {
    expect(
      cleanWiktionarySynonym({ word: "gdzie chleb i woda, tam nie ma głoda" }),
    ).toEqual([{ word: "gdzie chleb i woda, tam nie ma głoda", labels: [] }]);
    expect(cleanWiktionarySynonym({ word: "st. szer." })).toEqual([
      { word: "st. szer.", labels: [] },
    ]);
  });

  it("drops pointers to other entries", () => {
    expect(cleanWiktionarySynonym({ word: "zob. oszustwo" })).toEqual([]);
    expect(cleanWiktionarySynonym({ word: "por. korek" })).toEqual([]);
    expect(cleanWiktionarySynonym({ word: 7 })).toEqual([]);
  });
});

describe("senseIndices", () => {
  it.each([
    ["1.1", ["1.1"]],
    ["1.1-2", ["1.1", "1.2"]],
    ["1.1-1.3", ["1.1", "1.2", "1.3"]],
    ["1.1, 1.3", ["1.1", "1.3"]],
    ["1.1,3", ["1.1", "1.3"]],
    ["1.1, 1.2-3, 2.1", ["1.1", "1.2", "1.3", "2.1"]],
    ["1.10", ["1.10"]],
    ["", []],
    ["a", []],
  ])("reads %j", (index, expected) => {
    expect(senseIndices(index)).toEqual(expected);
  });
});

describe("parseSynonymEntry", () => {
  it("groups the synonyms by sense, with the glosses of the senses", () => {
    expect(
      parseSynonymEntry(
        line({
          word: "zamek",
          lang_code: "pl",
          pos: "noun",
          pos_title: "rzeczownik",
          senses: [
            { glosses: ["budowla obronna"], sense_index: "1.1" },
            { glosses: ["urządzenie do zamykania"], sense_index: "1.2" },
          ],
          synonyms: [
            { word: "warownia", sense_index: "1.1" },
            { word: "twierdza", sense_index: "1.1" },
            { word: "zasuwa", sense_index: "1.2" },
            { word: "suwak", sense_index: "1.3" },
            { word: "forteca", sense_index: "1.1-2" },
          ],
        }),
      ),
    ).toEqual({
      word: "zamek",
      entry: {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [
          {
            index: "1.1",
            gloss: "budowla obronna",
            synonyms: [
              { word: "warownia", labels: [] },
              { word: "twierdza", labels: [] },
            ],
          },
          {
            index: "1.2",
            gloss: "urządzenie do zamykania",
            synonyms: [{ word: "zasuwa", labels: [] }],
          },
          {
            index: "1.3",
            gloss: "",
            synonyms: [{ word: "suwak", labels: [] }],
          },
          {
            index: "1.1-2",
            gloss: "budowla obronna; urządzenie do zamykania",
            synonyms: [{ word: "forteca", labels: [] }],
          },
        ],
      },
    });
  });

  it("caps a long gloss of a range of senses", () => {
    const gloss = parseSynonymEntry(
      line({
        word: "x",
        lang_code: "pl",
        senses: [
          { glosses: ["a".repeat(150)], sense_index: "1.1" },
          { glosses: ["b".repeat(150)], sense_index: "1.2" },
        ],
        synonyms: [{ word: "y", sense_index: "1.1-2" }],
      }),
    )!.entry.senses[0].gloss;
    expect(gloss).toHaveLength(MAX_GLOSS);
    expect(gloss.endsWith("…")).toBe(true);
  });

  it("merges a repeated word of one sense and drops the headword", () => {
    expect(
      parseSynonymEntry(
        line({
          word: "dom",
          lang_code: "pl",
          pos: "noun",
          senses: [],
          synonyms: [
            { word: "gw. (Śląsk Cieszyński) dóm", sense_index: "1.1" },
            { word: "dóm", tags: ["dated"], sense_index: "1.1" },
            { word: "dom", sense_index: "1.1" },
          ],
        }),
      )?.entry.senses,
    ).toEqual([
      {
        index: "1.1",
        gloss: "",
        synonyms: [
          {
            word: "dóm",
            labels: ["dated", "dialectal"],
            region: "Śląsk Cieszyński",
          },
        ],
      },
    ]);
  });

  it("leaves out other languages and entries without synonyms", () => {
    const synonyms = [{ word: "kocur", sense_index: "1.1" }];
    expect(
      parseSynonymEntry(line({ word: "kot", lang_code: "cs", synonyms })),
    ).toBeNull();
    expect(
      parseSynonymEntry(line({ word: "kot", lang_code: "pl" })),
    ).toBeNull();
    expect(
      parseSynonymEntry(
        line({
          word: "kot",
          lang_code: "pl",
          synonyms: [{ word: "zob. kocur", sense_index: "1.1" }],
        }),
      ),
    ).toBeNull();
  });
});

describe("cleanThesaurusWord", () => {
  it.each([
    ["(potocznie) chata", "chata", ["colloquial"]],
    ["(bardzo potocznie) kasa", "kasa", ["veryColloquial"]],
    ["(rzadziej, wg niektórych niepoprawnie) abak", "abak", ["rare"]],
    ["(częściej) abakus", "abakus", []],
    ["(nieznana etykieta) słowo", "słowo", []],
    ["  dachowiec ", "dachowiec", []],
  ])("reads %j", (text, word, labels) => {
    expect(cleanThesaurusWord(text)).toEqual({ word, labels });
  });

  it("gives nothing for an empty item", () => {
    expect(cleanThesaurusWord("(potocznie) ")).toBeNull();
  });
});

describe("parseThesaurus", () => {
  it("reads the senses of each headword without the headword itself", () => {
    const text = [
      "UTF-8",
      "kot|1",
      "-|kot|dachowiec|(pieszczotliwie) kizia-mizia|mruczek",
      "zamek|2",
      "-|forteca|twierdza",
      "-|zasuwa|zatrzask",
      "",
    ].join("\n");
    expect(Object.fromEntries(parseThesaurus(text))).toEqual({
      kot: [
        [
          { word: "dachowiec", labels: [] },
          { word: "kizia-mizia", labels: ["endearing"] },
          { word: "mruczek", labels: [] },
        ],
      ],
      zamek: [
        [
          { word: "forteca", labels: [] },
          { word: "twierdza", labels: [] },
        ],
        [
          { word: "zasuwa", labels: [] },
          { word: "zatrzask", labels: [] },
        ],
      ],
    });
  });

  it("drops repeated senses, a word repeated in a sense and headwords left empty", () => {
    const text = [
      "UTF-8",
      "abak|3",
      "-|liczydło|arytmometr",
      "-|arytmometr|liczydło|(potocznie) liczydło",
      "-|abak",
      "ABC|1",
      "-|ABC",
    ].join("\n");
    expect(Object.fromEntries(parseThesaurus(text))).toEqual({
      abak: [
        [
          { word: "liczydło", labels: [] },
          { word: "arytmometr", labels: [] },
        ],
      ],
    });
  });
});

// The start of README_en.txt in pl-dict-latest.oxt (2026.10.01), with its BOM and CRLF.
const README = [
  "\uFEFFThis dictionary pack was created by the Polish Native Lang Project.",
  "",
  "Thesaurus",
  "----------",
  "Copyright (C) 2014-2026 Dobry słownik <redakcja@dobryslownik.pl>",
  "Copyright (C) 2004-2014 Marcin Miłkowski <milek_pl@users.sourceforge.net>",
  "This product is made available subject to the terms of GNU Lesser ",
  "General Public License Version 2.1.",
  "",
  "Generated on 2026.10.01. ",
  "",
  "Spellchecker",
  "------------",
  "",
  "This dictionary for spell-checking Polish texts is licensed under",
  "GPL, LGPL, MPL (Mozilla Public License) and Creative Commons",
].join("\r\n");

describe("thesaurusLicence", () => {
  const expected = SOURCES.dobryslownik.copyright!;

  it("reads the thesaurus section when its copyright matches the notice in the app", () => {
    const licence = thesaurusLicence(README, expected);
    expect(licence).toMatch(/^Copyright \(C\) 2014-2026 Dobry słownik/);
    expect(licence).toMatch(
      /GNU Lesser\s+General Public License Version 2\.1\.$/,
    );
    expect(licence).not.toContain("Spellchecker");
  });

  it("stops when the copyright lines changed, so the notice is never stale", () => {
    expect(() =>
      thesaurusLicence(README.replace("2014-2026", "2014-2027"), expected),
    ).toThrow(/copyright lines changed \(2014-2027 Dobry słownik; 2004-2014/);
    expect(() => thesaurusLicence(README, [...expected].reverse())).toThrow(
      /copyright lines changed/,
    );
  });

  it("stops when the thesaurus is not under the LGPL", () => {
    expect(() =>
      thesaurusLicence(
        README.replace("GNU Lesser \r\nGeneral", "GNU General"),
        expected,
      ),
    ).toThrow(/not LGPL/);
    expect(() => thesaurusLicence("Spellchecker\n---\nLGPL", expected)).toThrow(
      /not LGPL/,
    );
  });
});

describe("decodeThesaurus", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it("reads a UTF-8 file", () => {
    expect(decodeThesaurus(bytes("UTF-8\nkot|1\n-|mruczek\n"))).toBe(
      "UTF-8\nkot|1\n-|mruczek\n",
    );
  });

  it("stops on another encoding or bytes that are not UTF-8", () => {
    expect(() => decodeThesaurus(bytes("ISO8859-2\nkot|1\n"))).toThrow(
      /not in UTF-8/,
    );
    expect(() =>
      decodeThesaurus(new Uint8Array([...bytes("UTF-8\nk"), 0xb3, 0x0a])),
    ).toThrow();
  });
});
