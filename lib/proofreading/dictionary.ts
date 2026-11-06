import type { ProofreadIssue } from "./languagetool";

// User decision in task 30 (D60).
export const MAX_DICTIONARY_WORDS = 1000;
export const MAX_WORD_LENGTH = 50;

// Curly and straight apostrophes are the same letter to the writer.
const canonical = (text: string) => text.normalize("NFC").replace(/’/g, "'");

// A word as stored: trimmed, canonical, 1–50 UTF-16 units (as LT offsets and maxLength
// count), without whitespace. Null when not valid.
export function parseDictionaryWord(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const word = canonical(value.trim());
  if (word.length === 0 || word.length > MAX_WORD_LENGTH || /\s/.test(word))
    return null;
  return word;
}

// Stored data may be stale: invalid entries and duplicates are dropped, the limit kept.
export function normalizeDictionary(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of value) {
    const word = parseDictionaryWord(item);
    if (word === null || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words.slice(0, MAX_DICTIONARY_WORDS);
}

const capitalized = (word: string) => {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("");
};

// Like Hunspell: a word added in lower case also accepts its Capitalized and ALL CAPS forms,
// a word with capitals accepts itself and ALL CAPS. Inflected forms are separate words.
export function dictionaryMatcher(words: string[]): (text: string) => boolean {
  const accepted = new Set<string>();
  for (const word of words) {
    accepted.add(word);
    accepted.add(word.toUpperCase());
    if (word === word.toLowerCase()) accepted.add(capitalized(word));
  }
  return (text) => accepted.has(canonical(text));
}

// Only spelling issues: a word in the dictionary does not hide grammar or style (task 30).
export function filterIssues(
  markdown: string,
  issues: ProofreadIssue[],
  words: string[],
): ProofreadIssue[] {
  if (words.length === 0) return issues;
  const accepts = dictionaryMatcher(words);
  return issues.filter(
    ({ kind, offset, length }) =>
      kind !== "spelling" || !accepts(markdown.slice(offset, offset + length)),
  );
}
