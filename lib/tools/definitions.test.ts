import { describe, expect, it } from "vitest";
import { ToolsError } from "./client";
import { type Entry, MAX_GROUPS, rankDefinitions } from "./definitions";
import { externalLinks, wiktionaryUrl } from "./sources";

const entry = (gloss: string, extra: object = {}): Entry[] => [
  {
    pos: "noun",
    posTitle: "rzeczownik",
    senses: [{ index: "1.1", gloss, labels: [], examples: [], ...extra }],
  },
];

const answer = (
  lemmaRows: { form: string; lemma: string }[],
  rows: { word: string; entries: Entry[] }[],
) => ({
  lemmas: { source: "polimorf", rows: lemmaRows },
  definitions: { source: "wiktionary", rows },
});

describe("rankDefinitions", () => {
  it("shows the word as typed, then its lemmas, then other spellings", () => {
    const result = rankDefinitions(
      "kota",
      answer(
        [
          { form: "Kota", lemma: "Kot" },
          { form: "kota", lemma: "kot" },
          { form: "kota", lemma: "kota" },
        ],
        [
          { word: "Kot", entries: entry("nazwisko") },
          { word: "kot", entries: entry("zwierzę domowe") },
          { word: "Kota", entries: entry("imię") },
          { word: "kota", entries: entry("wysokość nad poziomem morza") },
        ],
      ),
    );
    expect(result.groups.map(({ headword }) => headword)).toEqual([
      "kota",
      "kot",
      "Kot",
      "Kota",
    ]);
    expect(result.sources).toEqual(["wiktionary", "polimorf"]);
  });

  it("names only Wikisłownik when no lemma is shown", () => {
    const result = rankDefinitions(
      "chatbot",
      answer(
        [{ form: "chatbot", lemma: "chatbot" }],
        [{ word: "chatbot", entries: entry("program") }],
      ),
    );
    expect(result).toEqual({
      groups: [{ headword: "chatbot", entries: entry("program") }],
      sources: ["wiktionary"],
    });
  });

  it("hides a headword that only points to another one with meanings", () => {
    const result = rankDefinitions(
      "tego",
      answer(
        [
          { form: "tego", lemma: "ten" },
          { form: "tego", lemma: "to" },
        ],
        [
          { word: "tego", entries: entry("od: ten", { reference: true }) },
          { word: "ten", entries: entry("wskazuje na osobę") },
        ],
      ),
    );
    expect(result.groups.map(({ headword }) => headword)).toEqual(["ten"]);
  });

  it("keeps a pointer when nothing else is found", () => {
    const entries = entry("aspekt dokonany od: odczytywać", {
      reference: true,
    });
    const result = rankDefinitions(
      "odczytać",
      answer(
        [{ form: "odczytać", lemma: "odczytać" }],
        [{ word: "odczytać", entries }],
      ),
    );
    expect(result.groups).toEqual([{ headword: "odczytać", entries }]);
  });

  it("gives no groups and no sources for an unknown word", () => {
    expect(rankDefinitions("xyzq", answer([], []))).toEqual({
      groups: [],
      sources: [],
    });
  });

  it("leaves out labels the app does not know", () => {
    const result = rankDefinitions(
      "kot",
      answer(
        [],
        [
          {
            word: "kot",
            entries: entry("x", { labels: ["colloquial", "fancy"] }),
          },
        ],
      ),
    );
    expect(result.groups[0].entries[0].senses[0].labels).toEqual([
      "colloquial",
    ]);
  });

  it(`shows at most ${MAX_GROUPS} headwords`, () => {
    const lemmas = Array.from({ length: 12 }, (_, i) => `lemat${i}`);
    const result = rankDefinitions(
      "forma",
      answer(
        lemmas.map((lemma) => ({ form: "forma", lemma })),
        lemmas.map((word) => ({ word, entries: entry("znaczenie") })),
      ),
    );
    expect(result.groups).toHaveLength(MAX_GROUPS);
  });

  const valid = answer([], [{ word: "kot", entries: entry("zwierzę") }]);
  it.each([
    null,
    { lemmas: valid.lemmas },
    { ...valid, definitions: { ...valid.definitions, source: "sjp" } },
    { ...valid, lemmas: { rows: [] } },
    {
      ...valid,
      definitions: { source: "wiktionary", rows: [{ word: "kot" }] },
    },
    answer([], [{ word: "kot", entries: entry("x", { examples: [1] }) }]),
    answer([], [{ word: "kot", entries: entry("x", { reference: false }) }]),
    answer(
      [],
      [
        {
          word: "kot",
          entries: [{ pos: "noun", senses: [] }] as unknown as Entry[],
        },
      ],
    ),
  ])("treats a malformed answer %j as an unavailable service", (response) => {
    expect(() => rankDefinitions("kot", response)).toThrow(ToolsError);
  });
});

describe("links", () => {
  it("builds the dictionary links for a word", () => {
    expect(externalLinks("żółw")).toEqual([
      {
        id: "wiktionary",
        url: "https://pl.wiktionary.org/wiki/%C5%BC%C3%B3%C5%82w",
      },
      { id: "sjp", url: "https://sjp.pl/%C5%BC%C3%B3%C5%82w" },
      {
        id: "pwn",
        url: "https://sjp.pwn.pl/slowniki/%C5%BC%C3%B3%C5%82w.html",
      },
    ]);
  });

  it("writes spaces of a Wikisłownik title as underscores", () => {
    expect(wiktionaryUrl("zamek błyskawiczny")).toBe(
      "https://pl.wiktionary.org/wiki/zamek_b%C5%82yskawiczny",
    );
    expect(externalLinks("o'clock")[1].url).toBe("https://sjp.pl/o'clock");
  });
});
