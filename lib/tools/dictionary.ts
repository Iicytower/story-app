import {
  MAX_WORD_LENGTH,
  parseDictionaryWord,
} from "@/lib/proofreading/dictionary";
import { toolsJson, ToolsError, type ToolsConfig } from "./client";

// Server Actions run one at a time per client, so autosave waits at most this long behind a
// lookup (task 25, D61).
export const DICTIONARY_TIMEOUT_MS = 2000;

// Each entry carries its source, for the attribution in the tools (task 25).
export type DictionarySource = "polimorf";
const SOURCES: readonly string[] = ["polimorf"] satisfies DictionarySource[];

export interface Lemma {
  lemma: string;
  source: DictionarySource;
}

// The query as the user typed it: one word, normalised as in the user dictionary (D60).
export const parseLookupWord = parseDictionaryWord;

const capitalized = (word: string) => {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("");
};

// Spellings sent to the service: "Kota" at the start of a sentence also finds "kota", and
// "nato" finds "NATO". Only the word itself leaves the app (task 25). A change of case can
// lengthen a word ("ß" → "SS"), and the service takes forms of up to 50 characters.
export function lookupForms(word: string): string[] {
  const lower = word.toLowerCase();
  return [
    ...new Set([word, lower, capitalized(lower), word.toUpperCase()]),
  ].filter((form) => form.length <= MAX_WORD_LENGTH);
}

// The service answers rows of {form, lemma}; lemmas of the form exactly as typed come first.
export function rankLemmas(word: string, response: unknown): Lemma[] {
  const { source, rows } = (response ?? {}) as {
    source?: unknown;
    rows?: unknown;
  };
  if (typeof source !== "string" || !SOURCES.includes(source)) {
    throw new ToolsError("UNAVAILABLE");
  }
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (row: { form?: unknown; lemma?: unknown } | null) =>
        typeof row?.form === "string" && typeof row.lemma === "string",
    )
  ) {
    throw new ToolsError("UNAVAILABLE");
  }
  const ordered = [
    ...rows.filter((row) => row.form === word),
    ...rows.filter((row) => row.form !== word),
  ];
  const lemmas = [
    ...new Set(ordered.map((row: { lemma: string }) => row.lemma)),
  ];
  return lemmas.map((lemma) => ({
    lemma,
    source: source as DictionarySource,
  }));
}

export async function findLemmas(
  config: ToolsConfig,
  word: string,
): Promise<Lemma[]> {
  const response = await toolsJson(config, "/dict/lemmas", {
    method: "POST",
    body: JSON.stringify({ forms: lookupForms(word) }),
    timeoutMs: DICTIONARY_TIMEOUT_MS,
  });
  return rankLemmas(word, response);
}
