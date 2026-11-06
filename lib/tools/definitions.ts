import { toolsJson, ToolsError, type ToolsConfig } from "./client";
import type { SourceId } from "./sources";
import { DICTIONARY_TIMEOUT_MS, lookupForms, rankLemmas } from "./dictionary";
import {
  type Entry,
  type Label,
  LABELS,
  type Sense,
} from "./wiktionary-import";

export type { Entry, Label, Sense };

// Headwords shown for one lookup: the word itself and its lemmas.
export const MAX_GROUPS = 8;

export interface DefinitionGroup {
  headword: string;
  entries: Entry[];
}

export interface Definitions {
  groups: DefinitionGroup[];
  // For the Sources block (task 32): the definitions, and the form table when a lemma was used.
  sources: SourceId[];
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const LABEL_SET: ReadonlySet<string> = new Set(LABELS);

function validSense(sense: unknown): sense is Sense {
  const { index, gloss, labels, region, examples, reference } = (sense ??
    {}) as Record<string, unknown>;
  return (
    typeof index === "string" &&
    typeof gloss === "string" &&
    isStrings(labels) &&
    (region === undefined || typeof region === "string") &&
    isStrings(examples) &&
    (reference === undefined || reference === true)
  );
}

function validEntry(entry: unknown): entry is Entry {
  const { pos, posTitle, senses } = (entry ?? {}) as Record<string, unknown>;
  return (
    typeof pos === "string" &&
    typeof posTitle === "string" &&
    Array.isArray(senses) &&
    senses.length > 0 &&
    senses.every(validSense)
  );
}

const hasMeaning = (group: DefinitionGroup) =>
  group.entries.some((entry) => entry.senses.some((sense) => !sense.reference));

// The service answers the lemma rows (as /lemmas) and the entries of the spellings and lemmas.
// Order: the word as typed, its lemmas (as rankLemmas), the other spellings. A headword whose
// only senses point elsewhere ("tego": "od: ten") goes when another one has meanings
// (criterion 4).
export function rankDefinitions(word: string, response: unknown): Definitions {
  const { lemmas, definitions } = (response ?? {}) as {
    lemmas?: unknown;
    definitions?: { source?: unknown; rows?: unknown };
  };
  const ranked = rankLemmas(word, lemmas).map(({ lemma }) => lemma);
  const rows = definitions?.rows;
  if (
    definitions?.source !== "wiktionary" ||
    !Array.isArray(rows) ||
    !rows.every(
      (row: { word?: unknown; entries?: unknown } | null) =>
        typeof row?.word === "string" &&
        Array.isArray(row.entries) &&
        row.entries.every(validEntry),
    )
  ) {
    throw new ToolsError("UNAVAILABLE");
  }
  // Labels added by a newer build than the app's are left out, not taken for a broken answer.
  const byWord = new Map(
    (rows as { word: string; entries: Entry[] }[]).map((row) => [
      row.word,
      row.entries.map((entry) => ({
        ...entry,
        senses: entry.senses.map((sense) => ({
          ...sense,
          labels: sense.labels.filter((label) => LABEL_SET.has(label)),
        })),
      })),
    ]),
  );
  const groups = [...new Set([word, ...ranked, ...lookupForms(word)])]
    .filter((headword) => byWord.has(headword))
    .slice(0, MAX_GROUPS)
    .map((headword) => ({ headword, entries: byWord.get(headword)! }));
  const shown = groups.some(hasMeaning) ? groups.filter(hasMeaning) : groups;
  return {
    groups: shown,
    sources:
      shown.length === 0
        ? []
        : shown.some(
              ({ headword }) => ranked.includes(headword) && headword !== word,
            )
          ? ["wiktionary", "polimorf"]
          : ["wiktionary"],
  };
}

export async function findDefinitions(
  config: ToolsConfig,
  word: string,
): Promise<Definitions> {
  const response = await toolsJson(config, "/dict/definitions", {
    method: "POST",
    body: JSON.stringify({ forms: lookupForms(word) }),
    timeoutMs: DICTIONARY_TIMEOUT_MS,
  });
  return rankDefinitions(word, response);
}
