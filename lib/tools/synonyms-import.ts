// Turns the synonym sources into the data the dictionary service serves (task 33, D63): the
// synonyms of the Polish Wiktionary dump (as in task 32) and the Dobry słownik thesaurus
// (MyThes `th_pl_PL_v2.dat`). Used only by `npm run dict:build`.
import { cleanSense, type Label, LABELS } from "./wiktionary-import";

// Wiktionary's labels and the thesaurus's own registers.
export const SYNONYM_LABELS = [
  ...LABELS,
  "veryColloquial",
  "specialist",
  "expressive",
  "jargon",
] as const;
export type SynonymLabel = Label | (typeof SYNONYM_LABELS)[number];
// Wiktionary's tags as in the definitions; the thesaurus's own registers only from the thesaurus.
const WIKTIONARY_LABELS: ReadonlySet<string> = new Set(LABELS);

export interface Synonym {
  word: string;
  labels: SynonymLabel[];
  // The region of a dialectal or regional word.
  region?: string;
}

export interface SynonymSense {
  // Wiktionary's sense number ("1.1", "1.1-2"), empty when the dump gives none.
  index: string;
  // The definitions of those senses; empty when none matches the number.
  gloss: string;
  synonyms: Synonym[];
}

export interface SynonymEntry {
  pos: string;
  posTitle: string;
  senses: SynonymSense[];
}

// A thesaurus sense: its synonyms, without a description.
export type ThesaurusSense = Synonym[];

const clean = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim();

const ordered = (labels: Set<string>): SynonymLabel[] =>
  SYNONYM_LABELS.filter((label) => labels.has(label));

// "gw. (Śląsk Cieszyński) dóm", "reg. pozn. kejter", "gw. (Górny Śląsk) jabko, płónka": the
// label and the region leak into the word, and one item can list several dialect words.
const DIALECT = /^(gw|reg|sł)\.\s*(?:\(([^()]+)\)|(\p{Ll}+\.))?\s+/u;
// Abbreviated regions, in full; others stay as written.
const REGIONS: Record<string, string> = {
  "śl.": "Śląsk",
  "pozn.": "Poznań",
  "białost.": "Białystok",
  "krak.": "Kraków",
  "kres.": "Kresy",
  "lwow.": "Lwów",
  "warsz.": "Warszawa",
  "gór.": "Podhale",
  "łódz.": "Łódź",
  "kuj.": "Kujawy",
  "kaszub.": "Kaszuby",
};
// Qualifiers written before the word ("stpol." is Old Polish, shown as obsolete, D63).
const PREFIXES: Record<string, SynonymLabel | null> = {
  stpol: "obsolete",
  pot: "colloquial",
  wulg: "vulgar",
  neutr: null,
};
const PREFIX = /^(stpol|pot|wulg|neutr)\.\s+/u;
// "zob. oszustwo", "por. korek": a pointer to another entry, not a synonym.
const POINTER = /^(zob|por)\.\s/u;

export function cleanWiktionarySynonym(raw: {
  word?: unknown;
  tags?: unknown;
}): Synonym[] {
  if (typeof raw.word !== "string") return [];
  let text = clean(raw.word);
  if (POINTER.test(text)) return [];
  const labels = new Set(
    (Array.isArray(raw.tags) ? raw.tags : []).filter(
      (tag): tag is string =>
        typeof tag === "string" && WIKTIONARY_LABELS.has(tag),
    ),
  );
  const prefix = PREFIX.exec(text);
  if (prefix) {
    const label = PREFIXES[prefix[1]];
    if (label) labels.add(label);
    text = text.slice(prefix[0].length);
  }
  const dialect = DIALECT.exec(text);
  if (!dialect) return text ? [{ word: text, labels: ordered(labels) }] : [];
  labels.add(dialect[1] === "gw" ? "dialectal" : "regional");
  const region = dialect[2]
    ? clean(dialect[2])
    : dialect[3]
      ? (REGIONS[dialect[3]] ?? dialect[3])
      : "";
  return text
    .slice(dialect[0].length)
    .split(/,\s*/)
    .map(clean)
    .filter(Boolean)
    .map((word) => ({
      word,
      labels: ordered(labels),
      ...(region && { region }),
    }));
}

// "1.1", "1.1-2" (1.1 and 1.2), "1.1, 1.3", "1.1,3" (1.1 and 1.3), "1.1-1.3".
export function senseIndices(index: string): string[] {
  const indices: string[] = [];
  let major: string | null = null;
  for (const part of index.split(/,\s*/)) {
    const match = /^(\d+)(?:\.(\d+))?(?:-(?:(\d+)\.)?(\d+))?$/.exec(
      part.trim(),
    );
    if (!match) return [];
    let [, first, minor] = match;
    const [, , , endMajor, end] = match;
    // A bare number after "1.1," is another sense of the same number.
    if (minor === undefined && major !== null) [first, minor] = [major, first];
    if (minor === undefined) {
      indices.push(first);
      continue;
    }
    major = first;
    const last =
      end === undefined || (endMajor && endMajor !== first) ? minor : end;
    for (let n = Number(minor); n <= Number(last); n++)
      indices.push(`${first}.${n}`);
  }
  return indices;
}

// Merges repeated words of one sense, keeping every label.
function mergeSynonyms(synonyms: Synonym[]): Synonym[] {
  const byWord = new Map<string, Synonym>();
  for (const synonym of synonyms) {
    const known = byWord.get(synonym.word);
    if (!known) {
      byWord.set(synonym.word, synonym);
      continue;
    }
    byWord.set(synonym.word, {
      ...known,
      labels: ordered(new Set([...known.labels, ...synonym.labels])),
      ...((known.region ?? synonym.region) && {
        region: known.region ?? synonym.region,
      }),
    });
  }
  return [...byWord.values()];
}

// A range of senses joins their glosses, which may run long.
export const MAX_GLOSS = 200;
const cap = (gloss: string) =>
  gloss.length <= MAX_GLOSS
    ? gloss
    : `${gloss.slice(0, MAX_GLOSS - 1).trimEnd()}…`;

interface RawEntry {
  word?: unknown;
  lang_code?: unknown;
  pos?: unknown;
  pos_title?: unknown;
  senses?: unknown;
  synonyms?: unknown;
}

// One line of the Wiktionary dump: the entry's synonyms by sense, with the glosses of those
// senses; null for other languages and entries without synonyms.
export function parseSynonymEntry(
  line: string,
): { word: string; entry: SynonymEntry } | null {
  const raw = JSON.parse(line) as RawEntry;
  if (raw.lang_code !== "pl" || typeof raw.word !== "string") return null;
  const word = clean(raw.word);
  if (!word || !Array.isArray(raw.synonyms)) return null;
  const glosses = new Map<string, string>();
  for (const sense of Array.isArray(raw.senses) ? raw.senses : []) {
    const cleaned = cleanSense(sense ?? {});
    // The region of a dialect sense stays with its gloss.
    if (cleaned?.index) {
      glosses.set(
        clean(cleaned.index),
        cleaned.region ? `${cleaned.gloss} (${cleaned.region})` : cleaned.gloss,
      );
    }
  }
  const bySense = new Map<string, Synonym[]>();
  for (const item of raw.synonyms as {
    word?: unknown;
    tags?: unknown;
    sense_index?: unknown;
  }[]) {
    const synonyms = cleanWiktionarySynonym(item ?? {}).filter(
      (synonym) => synonym.word !== word,
    );
    if (synonyms.length === 0) continue;
    const index =
      typeof item?.sense_index === "string" ? clean(item.sense_index) : "";
    bySense.set(index, [...(bySense.get(index) ?? []), ...synonyms]);
  }
  if (bySense.size === 0) return null;
  return {
    word,
    entry: {
      pos: typeof raw.pos === "string" ? raw.pos : "unknown",
      posTitle: typeof raw.pos_title === "string" ? raw.pos_title : "",
      senses: [...bySense].map(([index, synonyms]) => ({
        index,
        gloss: cap(
          senseIndices(index)
            .map((one) => glosses.get(one))
            .filter(Boolean)
            .join("; "),
        ),
        synonyms: mergeSynonyms(synonyms),
      })),
    },
  };
}

// The thesaurus's registers, written before the word: "(potocznie) chata".
const REGISTERS: Record<string, SynonymLabel | null> = {
  potocznie: "colloquial",
  "nieco potocznie": "colloquial",
  "potoczna nazwa": "colloquial",
  "bardzo potocznie": "veryColloquial",
  książkowo: "literary",
  "nieco książkowo": "literary",
  rzadziej: "rare",
  rzadko: "rare",
  specjalistycznie: "specialist",
  ekspresywnie: "expressive",
  "nieco ekspresywnie": "expressive",
  eufemistycznie: "euphemistic",
  pieszczotliwie: "endearing",
  przestarzale: "obsolete",
  "nieco przestarzale": "dated",
  pogardliwie: "pejorative",
  żartobliwie: "humorous",
  środowiskowo: "jargon",
  regionalnie: "regional",
  gwarowo: "dialectal",
  oficjalnie: "formal",
  podniośle: "elevatedly",
  // Says only that the word is more common than the headword.
  częściej: null,
};
const REGISTER = /^\(([^()]*)\)\s*/u;

export function cleanThesaurusWord(text: string): Synonym | null {
  let word = clean(text);
  const labels = new Set<string>();
  const register = REGISTER.exec(word);
  if (register) {
    // "rzadziej, wg niektórych niepoprawnie": the register is the first part.
    const label = REGISTERS[register[1].split(",")[0].trim()];
    if (label) labels.add(label);
    word = word.slice(register[0].length);
  }
  return word ? { word, labels: ordered(labels) } : null;
}

// MyThes: the encoding, then "headword|count" followed by that many "-|syn1|syn2" lines. Every
// member of a set is a headword of its own, and the headword is often among its synonyms.
export function parseThesaurus(text: string): Map<string, ThesaurusSense[]> {
  const words = new Map<string, ThesaurusSense[]>();
  let headword: string | null = null;
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    if (!line.startsWith("-|") && !line.startsWith("(")) {
      const bar = line.lastIndexOf("|");
      headword = bar > 0 ? clean(line.slice(0, bar)) : null;
      if (headword && !words.has(headword)) words.set(headword, []);
      continue;
    }
    if (!headword) continue;
    const synonyms = mergeSynonyms(
      line
        .split("|")
        .slice(1)
        .map(cleanThesaurusWord)
        .filter(
          (synonym): synonym is Synonym =>
            synonym !== null && synonym.word !== headword,
        ),
    );
    const senses = words.get(headword)!;
    const key = (sense: ThesaurusSense) =>
      sense
        .map(({ word }) => word)
        .sort()
        .join("|");
    if (
      synonyms.length > 0 &&
      !senses.some((sense) => key(sense) === key(synonyms))
    ) {
      senses.push(synonyms);
    }
  }
  for (const [word, senses] of words)
    if (senses.length === 0) words.delete(word);
  return words;
}

// The thesaurus file: MyThes names its encoding on the first line; only UTF-8 is read, and bad
// bytes stop the build instead of turning into U+FFFD.
export function decodeThesaurus(data: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  if (!text.startsWith("UTF-8\n")) {
    throw new Error("Dobry słownik: the thesaurus is not in UTF-8.");
  }
  return text;
}

// The thesaurus section of the package README (D63): LGPL, with the copyright lines the app
// shows (`expected`, with en dashes in the years).
export function thesaurusLicence(readme: string, expected: string[]): string {
  // The README lists each dictionary of the package; the thesaurus comes first.
  const licence = /^Thesaurus\n-+\n([\s\S]*?)\n\n/m
    .exec(readme.replace(/\r/g, "").replace(/^\uFEFF/, ""))?.[1]
    ?.trim();
  if (!licence?.includes("GNU Lesser")) {
    throw new Error("Dobry słownik: the thesaurus licence is not LGPL.");
  }
  const copyright = [...licence.matchAll(/^Copyright \(C\) (.+?) </gm)].map(
    (match) => match[1],
  );
  if (
    copyright.join("\n") !==
    expected.map((line) => line.replaceAll("–", "-")).join("\n")
  ) {
    throw new Error(
      `Dobry słownik: the copyright lines changed (${copyright.join("; ")}); update SOURCES in lib/tools/sources.ts.`,
    );
  }
  return licence;
}
