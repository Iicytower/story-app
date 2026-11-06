import { describe, expect, it } from "vitest";
import { ToolsError } from "./client";
import { MAX_HEADWORDS } from "./dictionary";
import { rankSynonyms } from "./synonyms";
import type { SynonymEntry, ThesaurusSense } from "./synonyms-import";

const lemmas = (...rows: [string, string][]) => ({
  source: "polimorf",
  rows: rows.map(([form, lemma]) => ({ form, lemma })),
});

const KOT_WIKTIONARY: SynonymEntry[] = [
  {
    pos: "noun",
    posTitle: "rzeczownik",
    senses: [
      {
        index: "1.1",
        gloss: "zwierzę domowe",
        synonyms: [
          { word: "dachowiec", labels: [] },
          { word: "sierściuch", labels: ["scornfully"] },
          { word: "kociamber", labels: ["dialectal"], region: "Poznań" },
        ],
      },
    ],
  },
];

const KOT_THESAURUS: ThesaurusSense[] = [
  [
    { word: "dachowiec", labels: [] },
    { word: "sierściuch", labels: ["colloquial"] },
    { word: "mruczek", labels: [] },
  ],
];

const answer = (
  rows: [string, string][],
  wiktionary: Record<string, SynonymEntry[]>,
  thesaurus: Record<string, ThesaurusSense[]>,
) => ({
  lemmas: lemmas(...rows),
  synonyms: {
    wiktionary: Object.entries(wiktionary).map(([word, entries]) => ({
      word,
      entries,
    })),
    thesaurus: Object.entries(thesaurus).map(([word, senses]) => ({
      word,
      senses,
    })),
  },
});

describe("rankSynonyms", () => {
  it("shows the lemma's synonyms in a section per source, marking words both give", () => {
    const result = rankSynonyms(
      "kota",
      answer(
        [
          ["kota", "kot"],
          ["kota", "kota"],
        ],
        { kot: KOT_WIKTIONARY },
        { kot: KOT_THESAURUS },
      ),
    );
    expect(result.sources).toEqual(["wiktionary", "dobryslownik", "polimorf"]);
    expect(result.groups).toHaveLength(1);
    const [group] = result.groups;
    expect(group.headword).toBe("kot");
    // Each occurrence keeps its own labels; the marks name every source (criteria 2, 3).
    expect(group.wiktionary[0].senses[0]).toEqual({
      index: "1.1",
      gloss: "zwierzę domowe",
      synonyms: [
        {
          word: "dachowiec",
          labels: [],
          sources: ["wiktionary", "dobryslownik"],
        },
        {
          word: "sierściuch",
          labels: ["scornfully"],
          sources: ["wiktionary", "dobryslownik"],
        },
        {
          word: "kociamber",
          labels: ["dialectal"],
          region: "Poznań",
          sources: ["wiktionary"],
        },
      ],
    });
    expect(group.thesaurus).toEqual([
      [
        {
          word: "dachowiec",
          labels: [],
          sources: ["wiktionary", "dobryslownik"],
        },
        {
          word: "sierściuch",
          labels: ["colloquial"],
          sources: ["wiktionary", "dobryslownik"],
        },
        { word: "mruczek", labels: [], sources: ["dobryslownik"] },
      ],
    ]);
  });

  it("names only the sources of the sections shown", () => {
    expect(
      rankSynonyms("kot", answer([], {}, { kot: KOT_THESAURUS })),
    ).toMatchObject({
      groups: [{ headword: "kot", wiktionary: [] }],
      sources: ["dobryslownik"],
    });
    expect(
      rankSynonyms("kot", answer([], { kot: KOT_WIKTIONARY }, {})).sources,
    ).toEqual(["wiktionary"]);
  });

  it("orders the word as typed, its lemmas, then other spellings", () => {
    const groups = rankSynonyms(
      "Kota",
      answer(
        [
          ["Kota", "Kot"],
          ["kota", "kot"],
        ],
        { kot: KOT_WIKTIONARY, Kota: KOT_WIKTIONARY },
        { Kot: KOT_THESAURUS },
      ),
    ).groups.map(({ headword }) => headword);
    expect(groups).toEqual(["Kota", "Kot", "kot"]);
  });

  it(`shows at most ${MAX_HEADWORDS} headwords`, () => {
    const rows = Array.from(
      { length: 12 },
      (_, n) => ["kota", `lemat${n}`] as [string, string],
    );
    const thesaurus = Object.fromEntries(
      rows.map(([, lemma]) => [lemma, KOT_THESAURUS]),
    );
    expect(
      rankSynonyms("kota", answer(rows, {}, thesaurus)).groups,
    ).toHaveLength(MAX_HEADWORDS);
  });

  it("gives no groups and no sources for an unknown word", () => {
    expect(rankSynonyms("xyzq", answer([], {}, {}))).toEqual({
      groups: [],
      sources: [],
    });
  });

  it("leaves out labels of a newer build", () => {
    const [group] = rankSynonyms(
      "kot",
      answer(
        [],
        {
          kot: [
            {
              ...KOT_WIKTIONARY[0],
              senses: [
                {
                  index: "1.1",
                  gloss: "",
                  synonyms: [
                    // "specialist" is a thesaurus register, not a Wiktionary label.
                    {
                      word: "a",
                      labels: ["new" as "rare", "specialist", "rare"],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { kot: [[{ word: "b", labels: ["new" as "rare", "specialist"] }]] },
      ),
    ).groups;
    expect(group.wiktionary[0].senses[0].synonyms[0].labels).toEqual(["rare"]);
    expect(group.thesaurus[0][0].labels).toEqual(["specialist"]);
  });

  it.each([
    ["no synonyms", { lemmas: lemmas() }],
    [
      "rows that are not a list",
      { ...answer([], {}, {}), synonyms: { wiktionary: {}, thesaurus: [] } },
    ],
    [
      "a malformed sense",
      answer(
        [],
        { kot: [{ ...KOT_WIKTIONARY[0], senses: [{}] }] as never },
        {},
      ),
    ],
    ["an empty thesaurus sense", answer([], {}, { kot: [[]] })],
    [
      "a synonym without a word",
      answer([], {}, { kot: [[{ labels: [] }]] as never }),
    ],
    [
      "lemma rows of an unknown source",
      { ...answer([], {}, {}), lemmas: { source: "x", rows: [] } },
    ],
  ])("takes %s for a broken answer", (_, response) => {
    expect(() => rankSynonyms("kot", response)).toThrow(ToolsError);
  });
});
