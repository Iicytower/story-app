import type { Locale } from "@/i18n/routing";
import { MAX_TAG_LENGTH, normalizeTag } from "./tags";

// Client-safe: no database code, the list comes from the server (D79).
export interface PredefinedTagView {
  key: string;
  labels: Record<Locale, string>;
}

// The key itself or any of its labels, as normalizeTag leaves them.
function spellings({ key, labels }: PredefinedTagView): string[] {
  return [key, ...Object.values(labels).map(normalizeTag)];
}

// A typed label becomes the key; anything else stays as it is.
export function canonicalTag(
  tag: string,
  predefined: PredefinedTagView[],
): string {
  const normalized = normalizeTag(tag);
  return (
    predefined.find((entry) => spellings(entry).includes(normalized))?.key ??
    normalized
  );
}

export function canonicalTags(
  tags: string[],
  predefined: PredefinedTagView[],
): string[] {
  return [...new Set(tags.map((tag) => canonicalTag(tag, predefined)))];
}

// Whole tags the search text stands for: itself and the key of a label it spells.
export function tagsForQuery(
  query: string,
  predefined: PredefinedTagView[],
): string[] {
  if (!query) return [];
  const normalized = normalizeTag(query);
  return [...new Set([normalized, canonicalTag(normalized, predefined)])];
}

export function labelOf(
  tag: string,
  predefined: PredefinedTagView[],
  locale: Locale,
): string | null {
  return predefined.find(({ key }) => key === tag)?.labels[locale] ?? null;
}

// For scripts/predefined-tags.ts: no spelling may point at two keys.
export function predefinedTagError(
  entry: PredefinedTagView,
  others: PredefinedTagView[],
): string | null {
  if (entry.key !== normalizeTag(entry.key) || !entry.key) {
    return `The key must be normalized: "${normalizeTag(entry.key)}".`;
  }
  for (const text of [entry.key, ...Object.values(entry.labels)]) {
    if (!text.trim()) return "Every label is required.";
    if (text.length > MAX_TAG_LENGTH) {
      return `"${text}" is longer than ${MAX_TAG_LENGTH} characters.`;
    }
  }
  const clash = others.find(
    (other) =>
      other.key !== entry.key &&
      spellings(other).some((spelling) => spellings(entry).includes(spelling)),
  );
  return clash ? `A spelling is already used by "${clash.key}".` : null;
}

export interface TagChoice {
  tag: string;
  // What the user sees: the label of a predefined tag, the tag itself otherwise.
  text: string;
}

export const MAX_SUGGESTIONS = 8;

// Choices whose tag or shown text contains what was typed, in the given order.
export function matchingSuggestions(
  input: string,
  choices: TagChoice[],
): TagChoice[] {
  const typed = normalizeTag(input);
  if (!typed) return [];
  return choices
    .filter(
      ({ tag, text }) =>
        tag.includes(typed) || normalizeTag(text).includes(typed),
    )
    .slice(0, MAX_SUGGESTIONS);
}
