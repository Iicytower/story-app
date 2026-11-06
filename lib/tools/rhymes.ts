import { toolsJson, ToolsError, type ToolsConfig } from "./client";
import { DICTIONARY_TIMEOUT_MS, lookupForms } from "./dictionary";
import { type RhymeKeys, rhymeKeys } from "./rhyme-key";
import { FUNCTION_WORD, GRAMMATICAL, VERBAL } from "./rhymes-import";
import type { SourceId } from "./sources";

export type RhymeLevel = "exact" | "near" | "last";
export const RHYME_LEVELS: RhymeLevel[] = ["exact", "near", "last"];

export interface RhymeGroup {
  level: RhymeLevel;
  // Shown at once: common words, best first.
  words: string[];
  // Behind "Show more": rare words, function words and grammatical rhymes.
  more: string[];
}

export interface Rhymes {
  groups: RhymeGroup[];
  sources: SourceId[];
}

// Zipf frequency × 100 of a common word: 2.5, about once in 3 million words.
export const COMMON_FREQUENCY = 250;
export const MAX_SHOWN = 40;
export const MAX_MORE = 100;
// Forms of one lemma in the whole result (task 34).
export const MAX_FORMS_PER_LEMMA = 2;

interface Row {
  form: string;
  phones: string;
  freq: number;
  lemmas: string;
  flags: number;
}

interface SelfRow extends Row {
  exact: string;
  near: string;
  last: string | null;
}

const isRow = (row: unknown): row is Row => {
  const { form, phones, freq, lemmas, flags } = (row ?? {}) as Record<
    string,
    unknown
  >;
  return (
    typeof form === "string" &&
    typeof phones === "string" &&
    Number.isInteger(freq) &&
    typeof lemmas === "string" &&
    Number.isInteger(flags)
  );
};

const isSelfRow = (row: unknown): row is SelfRow => {
  const { exact, near, last } = (row ?? {}) as Record<string, unknown>;
  return (
    isRow(row) &&
    typeof exact === "string" &&
    typeof near === "string" &&
    (last === null || typeof last === "string")
  );
};

function rowsOf<T>(rows: unknown, valid: (row: unknown) => row is T): T[] {
  if (!Array.isArray(rows) || !rows.every(valid)) {
    throw new ToolsError("UNAVAILABLE");
  }
  return rows;
}

// Phones in common at the end of two transcriptions.
function commonEnding(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let length = 0;
  while (
    length < x.length &&
    length < y.length &&
    x[x.length - 1 - length] === y[y.length - 1 - length]
  ) {
    length++;
  }
  return length;
}

const lemmaIds = (row: Row) => row.lemmas.split(",").filter(Boolean);

// The service answers the rows of the word's spellings and up to 150 rows of each level, the most
// frequent first. A spelling in the table brings its keys; `keys` are those of a word not in it.
export function rankRhymes(
  word: string,
  keys: RhymeKeys,
  response: unknown,
): Rhymes {
  const answer = (response ?? {}) as Record<string, unknown>;
  if (answer.source !== "rhymes") throw new ToolsError("UNAVAILABLE");
  const self = rowsOf(answer.self, isSelfRow);
  const levels = RHYME_LEVELS.map((level) => rowsOf(answer[level], isRow));

  const spellings = lookupForms(word);
  const own = spellings
    .map((spelling) => self.find((row) => row.form === spelling))
    .find(Boolean);
  const phones = own?.phones ?? keys.phones;
  const exactLength = [...(own?.exact ?? keys.exact)].length;
  const ownLemmas = new Set(self.flatMap(lemmaIds));
  const verbal = self.some((row) => row.flags & VERBAL);
  const typed = word.toLowerCase();

  const seen = new Set<string>();
  const perLemma = new Map<string, number>();
  const groups = RHYME_LEVELS.map((level, index): RhymeGroup => {
    const candidates = levels[index]
      .filter((row) => {
        if (seen.has(row.form)) return false;
        seen.add(row.form);
        const form = row.form.toLowerCase();
        // The word itself, its lemma and words of one stem (pisanie/napisanie): criterion 3.
        return (
          !form.endsWith(typed) &&
          !typed.endsWith(form) &&
          !lemmaIds(row).some((id) => ownLemmas.has(id))
        );
      })
      .map((row) => {
        const ending = commonEnding(row.phones, phones);
        const demoted =
          (row.flags & (FUNCTION_WORD | GRAMMATICAL)) !== 0 ||
          // Two verbal forms rhyming on their ending only (kochanie/czytanie): criterion 5.
          ((row.flags & VERBAL) !== 0 && verbal && ending <= exactLength);
        return {
          row,
          ending,
          shown: !demoted && row.freq >= COMMON_FREQUENCY,
        };
      })
      .sort(
        (a, b) =>
          Number(b.shown) - Number(a.shown) ||
          b.ending - a.ending ||
          b.row.freq - a.row.freq,
      );
    const words: string[] = [];
    const more: string[] = [];
    for (const { row, shown } of candidates) {
      const ids = lemmaIds(row);
      if (
        ids.length > 0 &&
        ids.every((id) => (perLemma.get(id) ?? 0) >= MAX_FORMS_PER_LEMMA)
      ) {
        continue;
      }
      const list = shown && words.length < MAX_SHOWN ? words : more;
      if (list === more && more.length >= MAX_MORE) continue;
      list.push(row.form);
      for (const id of ids) perLemma.set(id, (perLemma.get(id) ?? 0) + 1);
    }
    return { level, words, more };
  }).filter((group) => group.words.length + group.more.length > 0);

  return {
    groups,
    sources: groups.length > 0 ? ["polimorf", "wordfreq"] : [],
  };
}

export async function findRhymes(
  config: ToolsConfig,
  word: string,
): Promise<Rhymes> {
  // A word not in the table is taken for a verb by its ending (lib/tools/rhyme-key.ts).
  const keys = rhymeKeys(word);
  // Without a vowel ("w", "pkt") nothing rhymes.
  if (!keys) return { groups: [], sources: [] };
  const response = await toolsJson(config, "/dict/rhymes", {
    method: "POST",
    body: JSON.stringify({
      forms: lookupForms(word),
      keys: { exact: keys.exact, near: keys.near, last: keys.last },
    }),
    timeoutMs: DICTIONARY_TIMEOUT_MS,
  });
  return rankRhymes(word, keys, response);
}
