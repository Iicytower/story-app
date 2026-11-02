import { CRUDE_ROOTS } from "./data/crude-roots";
import {
  EN_ADJECTIVES,
  EN_EPITHETS,
  EN_FIRST,
  EN_NOUNS,
  EN_SECOND,
  EPITHET_ENDINGS,
  PL_EPITHETS,
  PL_FIRST,
  PL_PHRASES,
  PL_SECOND,
  SCIFI_FIRST,
  SCIFI_SECOND,
} from "./data/morphemes";
import { RARE_CLUSTERS, STYLE_TABLES, type StyleTable } from "./data/styles";
import { type Role, TYPE_SHAPES } from "./data/types";
import {
  effectiveFilters,
  type Filters,
  type Mood,
  type Style,
  STYLE_IDS,
} from "./filters";
import { isHard, isSoft, syllableCount, tokenize } from "./phonemes";
import { type GeneratedName, matchesFilters } from "./predicates";
import { mulberry32, pick, pickWeighted, type Rng } from "./rng";

const MAX_CANDIDATES = 5000;
const VOWEL_START = /^[aeiouyąęó]/;
const VOWEL_END = /[aeiouyąęó]$/;

interface Context {
  f: Filters;
  rng: Rng;
  pool: Style[];
  base: Style;
  origins: Set<Style>;
  gender: "male" | "female" | "neutral";
}

interface Syllable {
  style: Style;
  onset: string;
  nucleus: string;
  coda: string;
}

interface WordOptions {
  role: Role;
  prefix?: string;
  suffix?: string;
  infixes?: string[];
  decorate?: boolean;
}

const MOOD_LETTERS: Record<Mood, { consonants: string; vowels: string }> = {
  dark: { consonants: "k g r d t b z sz kh", vowels: "o u" },
  noble: { consonants: "r l n d v", vowels: "a e" },
  comic: { consonants: "b p k g z", vowels: "u o" },
  ethereal: { consonants: "l n m s h v f th", vowels: "i e ae ia" },
  common: { consonants: "m n k t s w", vowels: "a e o" },
};

function consonantWeight({ f }: Context, entry: string, style: Style): number {
  let weight = 1;
  for (const { text, vowel } of tokenize(entry, STYLE_TABLES[style].digraphs)) {
    if (vowel) continue;
    if (f.sound === "hard" || f.sound === "soft") {
      const favoured = f.sound === "hard" ? isHard(text) : isSoft(text);
      const opposed = f.sound === "hard" ? isSoft(text) : isHard(text);
      weight *= favoured ? 6 : opposed ? 0.15 : 1;
    }
    if (f.mood !== "any") {
      if (MOOD_LETTERS[f.mood].consonants.split(" ").includes(text))
        weight *= 4;
    }
  }
  return weight;
}

function vowelWeight({ f }: Context, entry: string): number {
  if (f.mood === "any") return 1;
  return MOOD_LETTERS[f.mood].vowels.split(" ").includes(entry) ? 4 : 1;
}

function shapeChances(f: Filters): { onset: number; coda: number } {
  if (f.balance === "vowel-heavy") return { onset: 0.5, coda: 0.05 };
  if (f.balance === "consonant-heavy") return { onset: 1, coda: 0.9 };
  if (f.mood === "common") return { onset: 1, coda: 0.15 };
  return { onset: 0.88, coda: 0.3 };
}

const isSimple = (entry: string, table: StyleTable) =>
  tokenize(entry, table.digraphs).length === 1;

function makeSyllable(ctx: Context, style: Style, isLast: boolean): Syllable {
  const { f, rng } = ctx;
  const table = STYLE_TABLES[style];
  const unpronounceable = f.pronunciation === "unpronounceable";
  const chances = unpronounceable ? { onset: 1, coda: 1 } : shapeChances(f);
  const openOnly = f.pronunciation === "easy" && !isLast;

  const nuclei =
    f.balance === "vowel-heavy"
      ? table.nuclei
      : table.nuclei.filter((nucleus) => nucleus.length === 1);
  const longNuclei = table.nuclei.filter((nucleus) => nucleus.length > 1);
  const useLong =
    (f.balance === "vowel-heavy" || f.mood === "ethereal") &&
    longNuclei.length > 0 &&
    rng() < 0.5;

  const weighted = (entries: string[]) =>
    pickWeighted(rng, entries, (entry) => consonantWeight(ctx, entry, style));

  return {
    style,
    onset: rng() < chances.onset ? weighted(table.onsets) : "",
    nucleus: useLong
      ? pick(rng, longNuclei)
      : pickWeighted(rng, nuclei, (entry) => vowelWeight(ctx, entry)),
    coda: !openOnly && rng() < chances.coda ? weighted(table.codas) : "",
  };
}

function targetSyllables({ f, rng }: Context): number {
  if (f.length === "short") return rng() < 0.3 ? 1 : 2;
  if (f.length === "medium") return 3;
  if (f.length === "long") return rng() < 0.7 ? 4 : 5;
  return rng() < 0.5 ? 2 : 3;
}

function endingFor(ctx: Context, role: Role, style: Style): string {
  const { rng, gender } = ctx;
  const table = STYLE_TABLES[style];
  switch (role) {
    case "first":
      return pick(rng, table[gender]);
    case "surname": {
      const ending = pick(rng, table.surname);
      return gender === "female" ? ending.replace(/ki$/, "ka") : ending;
    }
    case "epithet":
      return pick(rng, EPITHET_ENDINGS[style === "polish" ? "pl" : "en"]);
    case "place":
      return rng() < 0.7 ? pick(rng, table.place) : "";
    case "thing":
      return rng() < 0.6 ? pick(rng, table.thing) : "";
    default:
      return "";
  }
}

function syllableStyles(ctx: Context, count: number): Style[] {
  const { pool, rng, base } = ctx;
  if (pool.length === 1) return Array<Style>(count).fill(base);
  const first = pick(rng, pool);
  const others = pool.filter((style) => style !== first);
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return first;
    return i === 1 ? pick(rng, others) : pick(rng, pool);
  });
}

function buildWord(ctx: Context, options: WordOptions): string {
  const { f, rng, pool } = ctx;
  const { role, prefix = "", suffix, infixes = [], decorate = true } = options;
  const endingStyle = pick(rng, pool);
  const ending = suffix ?? endingFor(ctx, role, endingStyle);
  const digraphs = STYLE_TABLES[endingStyle].digraphs;
  if (ending && suffix === undefined) ctx.origins.add(endingStyle);

  let count = Math.max(
    1,
    targetSyllables(ctx) - syllableCount(tokenize(ending, digraphs)),
  );
  const unpronounceable = decorate && f.pronunciation === "unpronounceable";
  if (unpronounceable) count = Math.max(3, count + 1);
  if (decorate && (f.repeatedSyllable || f.punctuation)) {
    count = Math.max(2, count);
  }
  if (pool.length > 1) count = Math.max(2, count);

  const styles = syllableStyles(ctx, count);
  const syllables = styles.map((style, i) =>
    makeSyllable(ctx, style, i === count - 1),
  );
  for (const syllable of syllables) ctx.origins.add(syllable.style);

  const last = syllables[count - 1];
  if (ending && VOWEL_START.test(ending) && !last.coda) {
    const table = STYLE_TABLES[last.style];
    last.coda = pick(
      rng,
      table.codas.filter((coda) => isSimple(coda, table)),
    );
  } else if (ending && f.pronunciation === "easy") {
    last.coda = "";
  }
  if (prefix && !VOWEL_END.test(prefix)) syllables[0].onset = "";

  const exotic = decorate && f.pronunciation === "exotic";
  if (decorate && f.repeatedSyllable) {
    const at = Math.floor(rng() * (count - 1));
    if (exotic) syllables[at].onset = pick(rng, RARE_CLUSTERS);
    syllables[at].coda = "";
    syllables[at + 1] = { ...syllables[at] };
  } else if (exotic) {
    const at = count > 1 ? 1 : 0;
    syllables[at].onset = pick(rng, RARE_CLUSTERS);
    if (at > 0) syllables[at - 1].coda = "";
  }
  if (unpronounceable) {
    syllables[1].nucleus = "";
    // An ending adds a syllable of its own, which Short has no room for.
    if (f.length === "short") syllables[0].nucleus = "";
  }

  const pieces = syllables.map((s) => s.onset + s.nucleus + s.coda);
  const numbered =
    decorate && f.punctuation && styles.includes("scifi") && rng() < 0.4;
  if (decorate && f.punctuation && !numbered) {
    pieces[0] += rng() < 0.7 ? "'" : "-";
  }
  for (const infix of infixes) {
    pieces.splice(Math.floor(rng() * (pieces.length + 1)), 0, infix);
  }
  const tail = numbered ? `-${Math.floor(rng() * 9) + 1}` : "";
  return finish(prefix + pieces.join("") + ending + tail);
}

function finish(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function wordsWanted({ f, rng }: Context): number {
  if (f.wordCount === "one") return 1;
  if (f.wordCount === "two") return 2;
  if (f.wordCount === "three") return 3;
  if (f.alliteration) return rng() < 0.75 ? 2 : 3;
  return 1;
}

function moodList(lists: Record<Mood, string[]>, mood: Filters["mood"]) {
  return mood === "any" ? Object.values(lists).flat() : lists[mood];
}

function hasStructuralFilters(f: Filters): boolean {
  return Boolean(
    f.startsWith.trim() ||
    f.endsWith.trim() ||
    f.contains.trim() ||
    f.crude === "only" ||
    f.alliteration ||
    f.repeatedSyllable ||
    f.punctuation ||
    f.pronunciation === "exotic" ||
    f.pronunciation === "unpronounceable",
  );
}

// Returns the words of a meaningful name, or null when syllables must be used instead.
function morphemes(ctx: Context, role: Role, words: number): string[] | null {
  const { f, rng, base, pool } = ctx;
  if (pool.length > 1 || hasStructuralFilters(f) || words > 2) return null;
  if (role === "first" || role === "surname") return null;
  if (rng() > (f.mood === "any" ? 0.35 : 0.6)) return null;

  if (role === "epithet") {
    if (f.wordCount !== "any") return null;
    return [
      pick(
        rng,
        moodList(base === "polish" ? PL_EPITHETS : EN_EPITHETS, f.mood),
      ),
    ];
  }
  if (base === "polish") {
    if (words === 2) {
      return pick(rng, moodList(PL_PHRASES, f.mood)).split("|");
    }
    const kind = role === "place" ? "place" : "thing";
    return [pick(rng, moodList(PL_FIRST, f.mood)) + pick(rng, PL_SECOND[kind])];
  }
  if (base === "scifi") {
    const first = pick(rng, SCIFI_FIRST);
    const second = pick(rng, SCIFI_SECOND);
    return words === 2 ? [first, finish(second)] : [first + second];
  }
  if (words === 2) {
    return [
      pick(rng, moodList(EN_ADJECTIVES, f.mood)),
      pick(rng, moodList(EN_NOUNS, f.mood)),
    ];
  }
  const kind = role === "place" ? "place" : role === "org" ? "org" : "thing";
  return [pick(rng, moodList(EN_FIRST, f.mood)) + pick(rng, EN_SECOND[kind])];
}

function candidate(f: Filters, rng: Rng): GeneratedName {
  const styles = f.styles.length > 0 ? f.styles : STYLE_IDS;
  const base = pick(rng, styles);
  const gender =
    f.gender === "any"
      ? pick(rng, ["male", "female", "neutral"] as const)
      : f.gender;
  const ctx: Context = {
    f,
    rng,
    base,
    pool: f.mixStyles ? styles : [base],
    origins: new Set(),
    gender,
  };

  const shape = TYPE_SHAPES[f.type];
  const lang = base === "polish" ? "pl" : "en";
  const starts = f.startsWith.trim().toLowerCase();
  const ends = f.endsWith.trim().toLowerCase();
  const templates = shape[lang].filter(
    (template) =>
      (!starts || template.startsWith("{}")) &&
      (!ends || template.endsWith("{}")),
  );
  const template = pick(rng, templates.length > 0 ? templates : shape[lang]);

  const count = wordsWanted(ctx);
  const ready = morphemes(
    ctx,
    shape.role,
    f.wordCount === "any" && rng() < 0.4 ? 2 : count,
  );
  if (ready) {
    ctx.origins.add(base);
    return {
      text: template.replace("{}", ready.join(" ")),
      origins: [...ctx.origins],
    };
  }

  const inserted = [
    ...(f.contains.trim() ? [f.contains.trim().toLowerCase()] : []),
    ...(f.crude === "only" ? [pick(rng, CRUDE_ROOTS).toLowerCase()] : []),
  ];
  const infixAt = Math.floor(rng() * count);
  const words: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const role = f.type === "full-name" && i === 1 ? "surname" : shape.role;
    let prefix = i === 0 ? starts : "";
    if (i > 0 && f.alliteration) {
      prefix = tokenize(words[0], STYLE_TABLES[base].digraphs)[0].text;
    }
    words.push(
      buildWord(ctx, {
        role,
        prefix,
        suffix: i === count - 1 && ends ? ends : undefined,
        infixes: i === infixAt ? inserted : [],
        decorate: i === 0,
      }),
    );
  }
  return {
    text: template.replace("{}", words.join(" ")),
    origins: [...ctx.origins],
  };
}

export interface GenerateOptions {
  filters: Filters;
  seed: number;
  seen?: ReadonlySet<string>;
  count?: number;
  maxCandidates?: number;
}

export function generate({
  filters,
  seed,
  seen = new Set(),
  count = 10,
  maxCandidates = MAX_CANDIDATES,
}: GenerateOptions): GeneratedName[] {
  const f = effectiveFilters(filters);
  const rng = mulberry32(seed);
  const used = new Set(seen);
  const names: GeneratedName[] = [];
  for (let i = 0; i < maxCandidates && names.length < count; i += 1) {
    const name = candidate(f, rng);
    const key = name.text.toLowerCase();
    if (used.has(key) || !matchesFilters(name, f)) continue;
    used.add(key);
    names.push(name);
  }
  return names;
}
