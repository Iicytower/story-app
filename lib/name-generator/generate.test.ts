import { describe, expect, it } from "vitest";
import { CONFLICTS, selectValue } from "./conflicts";
import { containsCrude } from "./crude";
import {
  EN_ADJECTIVES,
  EN_EPITHETS,
  EN_FIRST,
  EN_NOUNS,
  EN_SECOND,
  PL_EPITHETS,
  PL_FIRST,
  PL_PHRASES,
  PL_SECOND,
} from "./data/morphemes";
import { STYLE_TABLES } from "./data/styles";
import {
  CRUDE_OPTIONS,
  DEFAULT_FILTERS,
  type Filters,
  NAME_TYPES,
  SINGLE_GROUPS,
  type SingleGroup,
  STYLE_IDS,
  TOGGLES,
} from "./filters";
import { generate } from "./generate";
import { tokenize } from "./phonemes";
import {
  digraphsOf,
  matchesFilters,
  significantWords,
  soundScore,
  vowelShare,
} from "./predicates";
import { mulberry32, pick } from "./rng";

const SEEDS = [1, 2, 3];

const ALL_KEYS = [
  ...STYLE_IDS.map((style) => `style:${style}`),
  ...(Object.keys(SINGLE_GROUPS) as SingleGroup[]).flatMap((group) =>
    SINGLE_GROUPS[group].options.map(
      (option: { value: string }) => `${group}:${option.value}`,
    ),
  ),
  ...Object.keys(TOGGLES).map((toggle) => `${toggle}:on`),
  "polishLetters:off",
];

const conflicting = (a: string, b: string) =>
  a.split(":")[0] === b.split(":")[0] && !a.startsWith("style:")
    ? true
    : CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function withCrude(filters: Filters, crude: Filters["crude"]): Filters {
  return { ...filters, crude };
}

describe("types and styles", () => {
  it.each(NAME_TYPES)("%s gives 10 names in every style", (type) => {
    for (const style of STYLE_IDS) {
      const names = generate({
        filters: { ...DEFAULT_FILTERS, type, styles: [style] },
        seed: 1,
      });
      expect(names, style).toHaveLength(10);
    }
  });
});

describe("results", () => {
  it("is the same for the same seed", () => {
    const run = () => generate({ filters: DEFAULT_FILTERS, seed: 99 });
    expect(run()).toEqual(run());
  });

  it("differs for another seed", () => {
    const names = (seed: number) =>
      generate({ filters: DEFAULT_FILTERS, seed }).map((n) => n.text);
    expect(names(1)).not.toEqual(names(2));
  });

  it("has no repeats within a batch", () => {
    const names = generate({ filters: DEFAULT_FILTERS, seed: 1 }).map((n) =>
      n.text.toLowerCase(),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("skips names already shown", () => {
    const seen = new Set<string>();
    for (let round = 0; round < 5; round += 1) {
      for (const { text } of generate({
        filters: DEFAULT_FILTERS,
        seed: 1,
        seen,
      })) {
        expect(seen.has(text.toLowerCase())).toBe(false);
        seen.add(text.toLowerCase());
      }
    }
    expect(seen.size).toBe(50);
  });

  it("meets every hard filter in random combinations", () => {
    const rng = mulberry32(2024);
    let produced = 0;
    for (let round = 0; round < 300; round += 1) {
      let filters: Filters = {
        ...DEFAULT_FILTERS,
        type: pick(rng, NAME_TYPES),
      };
      for (let i = 0; i < 3; i += 1) {
        filters = selectValue(filters, pick(rng, ALL_KEYS));
      }
      filters = withCrude(filters, pick(rng, CRUDE_OPTIONS).value);
      const names = generate({ filters, seed: round, maxCandidates: 500 });
      produced += names.length;
      for (const name of names) {
        expect(matchesFilters(name, filters), name.text).toBe(true);
      }
    }
    expect(produced).toBeGreaterThan(1000);
  });

  it("uses the text fields", () => {
    const filters: Filters = {
      ...DEFAULT_FILTERS,
      type: "city",
      startsWith: "Kar",
      endsWith: "or",
      contains: "mel",
      excludes: "x,z",
    };
    const names = generate({ filters, seed: 1 });
    expect(names).toHaveLength(10);
    for (const { text } of names) {
      expect(text.toLowerCase()).toMatch(/^kar.*mel.*or$|^karmel.*or$/);
    }
  });
});

describe("limits", () => {
  it("returns nothing when the text fields rule everything out", () => {
    const filters = { ...DEFAULT_FILTERS, startsWith: "a", excludes: "a" };
    expect(generate({ filters, seed: 1 })).toEqual([]);
  });

  it("stops at the candidate limit", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      endsWith: "qqq",
      gender: "female" as const,
    };
    const started = performance.now();
    expect(generate({ filters, seed: 1 })).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it("returns fewer names when the limit ends the search", () => {
    const filters = { ...DEFAULT_FILTERS, type: "epithet" as const };
    const names = generate({ filters, seed: 1, maxCandidates: 3 });
    expect(names.length).toBeLessThanOrEqual(3);
  });
});

describe("mood", () => {
  const sample = (filters: Filters) =>
    SEEDS.flatMap((seed) =>
      generate({
        filters: { ...filters, styles: ["english"] },
        seed,
        count: 100,
      }),
    ).map(({ text, origins }) =>
      significantWords(text).map((w) => tokenize(w, digraphsOf(origins))),
    );
  const mean = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) / values.length;

  it("makes Dark names harder than Any", () => {
    const dark = mean(
      sample({ ...DEFAULT_FILTERS, mood: "dark" }).map(soundScore),
    );
    const any = mean(sample(DEFAULT_FILTERS).map(soundScore));
    expect(dark - any).toBeGreaterThan(0.1);
  });

  it("makes Ethereal names softer than Any", () => {
    const soft = mean(
      sample({ ...DEFAULT_FILTERS, mood: "ethereal" }).map(soundScore),
    );
    const any = mean(sample(DEFAULT_FILTERS).map(soundScore));
    expect(any - soft).toBeGreaterThan(0.1);
  });

  it("gives Ethereal names more vowels than Dark ones", () => {
    const share = (mood: Filters["mood"]) =>
      mean(sample({ ...DEFAULT_FILTERS, mood }).map(vowelShare));
    expect(share("ethereal") - share("dark")).toBeGreaterThan(0.03);
  });

  it("picks morphemes tagged with the mood", () => {
    const filters: Filters = {
      ...DEFAULT_FILTERS,
      type: "city",
      styles: ["english"],
      mood: "dark",
    };
    const texts = generate({ filters, seed: 1, count: 100 }).map((n) => n.text);
    const dark = texts.filter((t) =>
      EN_FIRST.dark.some((w) => t.startsWith(w)),
    );
    const noble = texts.filter((t) =>
      EN_FIRST.noble.some((w) => t.startsWith(w)),
    );
    expect(dark.length).toBeGreaterThan(10);
    expect(noble).toHaveLength(0);
  });
});

describe("styles", () => {
  const styles: Filters["styles"] = ["elvish", "orcish", "latin"];

  it("keeps a whole name in one style without Mix styles", () => {
    for (const seed of SEEDS) {
      const names = generate({
        filters: { ...DEFAULT_FILTERS, styles },
        seed,
        count: 50,
      });
      expect(new Set(names.flatMap((n) => n.origins)).size).toBeGreaterThan(1);
      for (const { origins } of names) expect(origins).toHaveLength(1);
    }
  });

  it("mixes styles within a name with Mix styles", () => {
    const names = generate({
      filters: { ...DEFAULT_FILTERS, styles, mixStyles: true },
      seed: 1,
      count: 50,
    });
    expect(names.filter((n) => n.origins.length > 1).length).toBeGreaterThan(
      40,
    );
    for (const { origins } of names) {
      expect(origins.every((s) => styles.includes(s))).toBe(true);
    }
  });

  it("writes meaningful Polish names in Polish only", () => {
    const filters: Filters = {
      ...DEFAULT_FILTERS,
      type: "city",
      styles: ["polish"],
    };
    const texts = generate({ filters, seed: 1, count: 200 }).map((n) => n.text);
    const polish = Object.values(PL_FIRST).flat();
    const english = Object.values(EN_FIRST)
      .flat()
      .flatMap((first) => EN_SECOND.place.map((second) => first + second));
    expect(texts.some((t) => polish.some((w) => t.startsWith(w)))).toBe(true);
    expect(texts.filter((t) => english.includes(t))).toEqual([]);
  });

  it("has tables for every style", () => {
    for (const style of STYLE_IDS) {
      expect(STYLE_TABLES[style].onsets.length).toBeGreaterThan(0);
    }
  });
});

describe("crude part", () => {
  const run = (crude: Filters["crude"], seed: number) =>
    generate({ filters: { ...DEFAULT_FILTERS, crude }, seed, count: 50 });

  it("Exclude lets nothing crude through", () => {
    for (const seed of SEEDS) {
      for (const { text } of run("exclude", seed)) {
        expect(containsCrude(text), text).toBe(false);
      }
    }
  });

  it("Only returns crude names alone", () => {
    for (const seed of SEEDS) {
      const names = run("only", seed);
      expect(names).toHaveLength(50);
      for (const { text } of names) {
        expect(containsCrude(text), text).toBe(true);
      }
    }
  });

  it("Allow does not filter", () => {
    const filters: Filters = { ...DEFAULT_FILTERS, crude: "allow" };
    const crude = { text: "Kurwon", origins: ["english" as const] };
    expect(matchesFilters(crude, filters)).toBe(true);
  });

  it("does not flag the words of meaningful names", () => {
    const words = [
      EN_ADJECTIVES,
      EN_EPITHETS,
      EN_FIRST,
      EN_NOUNS,
      PL_EPITHETS,
      PL_FIRST,
      PL_PHRASES,
      EN_SECOND,
      PL_SECOND,
    ].flatMap((lists) => Object.values(lists).flat());
    expect(words.filter(containsCrude)).toEqual([]);
  });
});

describe("pairs", () => {
  const pairs = ALL_KEYS.flatMap((a, i) =>
    ALL_KEYS.slice(i + 1)
      .filter((b) => !conflicting(a, b))
      .map((b) => [a, b] as const),
  );

  it.each(["first-name", "city", "guild"] as const)(
    "every allowed pair gives 10 names for %s",
    (type) => {
      const failed: string[] = [];
      for (const [a, b] of pairs) {
        const filters = selectValue(
          selectValue({ ...DEFAULT_FILTERS, type }, a),
          b,
        );
        if (generate({ filters, seed: 1 }).length < 10)
          failed.push(`${a} ${b}`);
      }
      expect(failed).toEqual([]);
    },
    60_000,
  );
});
