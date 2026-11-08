import { toolsJson, ToolsError, type ToolsConfig } from "./client";
import {
  DICTIONARY_TIMEOUT_MS,
  lookupForms,
  orderHeadwords,
  rankLemmas,
} from "./dictionary";
import type { SourceId } from "./sources";
import {
  type Synonym,
  type SynonymEntry,
  type SynonymLabel,
  SYNONYM_LABELS,
  type ThesaurusSense,
} from "./synonyms-import";
import { LABELS } from "./wiktionary-import";

export type { SynonymLabel };

export type SynonymSource = "wiktionary" | "dobryslownik";

// A synonym with its own labels and every source listing it for the headword (criteria 2, 3).
export interface SynonymItem extends Synonym {
  sources: SynonymSource[];
}

export interface WiktionarySynonyms {
  pos: string;
  posTitle: string;
  senses: { index: string; gloss: string; synonyms: SynonymItem[] }[];
}

// A section per source (decision of the user, D63).
export interface SynonymGroup {
  headword: string;
  wiktionary: WiktionarySynonyms[];
  thesaurus: SynonymItem[][];
}

export interface Synonyms {
  groups: SynonymGroup[];
  sources: SourceId[];
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function validSynonym(synonym: unknown): synonym is Synonym {
  const { word, labels, region } = (synonym ?? {}) as Record<string, unknown>;
  return (
    typeof word === "string" &&
    isStrings(labels) &&
    (region === undefined || typeof region === "string")
  );
}

const validSynonyms = (value: unknown): value is Synonym[] =>
  Array.isArray(value) && value.length > 0 && value.every(validSynonym);

function validEntry(entry: unknown): entry is SynonymEntry {
  const { pos, posTitle, senses } = (entry ?? {}) as Record<string, unknown>;
  return (
    typeof pos === "string" &&
    typeof posTitle === "string" &&
    Array.isArray(senses) &&
    senses.length > 0 &&
    senses.every((sense: Record<string, unknown> | null) => {
      const { index, gloss, synonyms } = sense ?? {};
      return (
        typeof index === "string" &&
        typeof gloss === "string" &&
        validSynonyms(synonyms)
      );
    })
  );
}

function rowsOf<T>(
  rows: unknown,
  field: "entries" | "senses",
  valid: (item: unknown) => item is T,
): Map<string, T[]> {
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (row: Record<string, unknown> | null) =>
        typeof row?.word === "string" &&
        Array.isArray(row[field]) &&
        (row[field] as unknown[]).length > 0 &&
        (row[field] as unknown[]).every(valid),
    )
  ) {
    throw new ToolsError("UNAVAILABLE");
  }
  return new Map(
    (rows as Record<string, unknown>[]).map((row) => [
      row.word as string,
      row[field] as T[],
    ]),
  );
}

// Labels added by a newer build than the app's are left out, not taken for a broken answer.
const WIKTIONARY_LABELS: ReadonlySet<string> = new Set(LABELS);
const THESAURUS_LABELS: ReadonlySet<string> = new Set(SYNONYM_LABELS);

const known =
  (labels: ReadonlySet<string>) =>
  (synonym: Synonym): Synonym => ({
    ...synonym,
    labels: synonym.labels.filter((label) => labels.has(label)),
  });

// The service answers the lemma rows (as /lemmas) and the synonyms of the spellings and lemmas
// from each source. Groups go in the order of orderHeadwords; within a group each source has its
// own section, and a word both sources give shows up in both, marked with both.
export function rankSynonyms(word: string, response: unknown): Synonyms {
  const { lemmas, synonyms } = (response ?? {}) as {
    lemmas?: unknown;
    synonyms?: { wiktionary?: unknown; thesaurus?: unknown };
  };
  const ranked = rankLemmas(word, lemmas).map(({ lemma }) => lemma);
  const wiktionary = rowsOf(synonyms?.wiktionary, "entries", validEntry);
  const thesaurus = rowsOf(
    synonyms?.thesaurus,
    "senses",
    (sense): sense is ThesaurusSense => validSynonyms(sense),
  );

  const groups = orderHeadwords(
    word,
    ranked,
    (headword) => wiktionary.has(headword) || thesaurus.has(headword),
  ).map((headword): SynonymGroup => {
    const entries = wiktionary.get(headword) ?? [];
    const senses = thesaurus.get(headword) ?? [];
    const inWiktionary = new Set(
      entries.flatMap((entry) =>
        entry.senses.flatMap((sense) => sense.synonyms.map((s) => s.word)),
      ),
    );
    const inThesaurus = new Set(senses.flat().map((s) => s.word));
    const mark = (synonym: Synonym): SynonymItem => ({
      ...synonym,
      sources: [
        ...(inWiktionary.has(synonym.word) ? (["wiktionary"] as const) : []),
        ...(inThesaurus.has(synonym.word) ? (["dobryslownik"] as const) : []),
      ],
    });
    return {
      headword,
      wiktionary: entries.map((entry) => ({
        pos: entry.pos,
        posTitle: entry.posTitle,
        senses: entry.senses.map((sense) => ({
          index: sense.index,
          gloss: sense.gloss,
          synonyms: sense.synonyms.map(known(WIKTIONARY_LABELS)).map(mark),
        })),
      })),
      thesaurus: senses.map((sense) =>
        sense.map(known(THESAURUS_LABELS)).map(mark),
      ),
    };
  });

  const sources: SourceId[] = [];
  if (groups.some((group) => group.wiktionary.length > 0)) {
    sources.push("wiktionary");
  }
  if (groups.some((group) => group.thesaurus.length > 0)) {
    sources.push("dobryslownik");
  }
  if (
    groups.some(
      ({ headword }) => headword !== word && ranked.includes(headword),
    )
  ) {
    sources.push("polimorf");
  }
  return { groups, sources };
}

export async function findSynonyms(
  config: ToolsConfig,
  word: string,
): Promise<Synonyms> {
  const response = await toolsJson(config, "/dict/synonyms", {
    method: "POST",
    body: JSON.stringify({ forms: lookupForms(word) }),
    timeoutMs: DICTIONARY_TIMEOUT_MS,
  });
  return rankSynonyms(word, response);
}
