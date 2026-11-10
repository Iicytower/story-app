import { diffChars } from "diff";

// Where a reader's note was made: the quote with up to 50 characters around it and how far into
// the chapter text it started (0–1). Offsets are in UTF-16 code units of the text, as in the DOM.
export interface QuoteAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  position: number;
}

export interface TextSpan {
  start: number;
  end: number;
}

// A changed passage still counts as the quote when at least this share of it is kept.
const MIN_SIMILARITY = 0.7;
// A short quote such as "Yes." occurs all over a chapter: alone it counts only near its old place.
const SHORT_QUOTE_LENGTH = 15;
const SHORT_QUOTE_REACH = 1000;
// Bounds the diff of a long chapter; a slower comparison counts as no match.
const DIFF_TIMEOUT_MS = 50;

// The occurrence closest to where the quote was, for a passage repeated in the chapter.
function nearest(text: string, needle: string, expected: number): number {
  let best = -1;
  for (
    let index = text.indexOf(needle);
    index !== -1;
    index = text.indexOf(needle, index + 1)
  ) {
    if (best === -1 || Math.abs(index - expected) < Math.abs(best - expected)) {
      best = index;
    }
    if (index > expected) break;
  }
  return best;
}

interface Run {
  start: number;
  end: number;
  score: number;
  common: number;
}

// The densest run of characters the area shares with the quote, and how similar it is.
function bestMatch(
  quote: string,
  text: string,
  from: number,
  to: number,
): { span: TextSpan; similarity: number } | null {
  const start = Math.max(0, from);
  const area = text.slice(start, Math.min(text.length, to));
  if (!area) return null;
  // More edits than this leave less of the quote than MIN_SIMILARITY.
  const maxEditLength =
    quote.length + area.length - 2 * Math.ceil(quote.length * MIN_SIMILARITY);
  if (maxEditLength < 0) return null;
  const changes = diffChars(quote, area, {
    maxEditLength,
    timeout: DIFF_TIMEOUT_MS,
  });
  if (!changes) return null;
  let at = start;
  let run: Run | null = null;
  let best: Run | null = null;
  for (const change of changes) {
    const length = change.value.length;
    if (change.removed) continue;
    if (change.added) {
      if (run) run.score -= length;
      at += length;
      continue;
    }
    if (!run || run.score <= 0) {
      run = { start: at, end: at, score: 0, common: 0 };
    }
    run.end = at + length;
    run.score += length;
    run.common += length;
    if (!best || run.score > best.score) best = { ...run };
    at += length;
  }
  if (!best) return null;
  const span = { start: best.start, end: best.end };
  return {
    span,
    similarity: best.common / Math.max(quote.length, span.end - span.start),
  };
}

// Finds a note's passage in the chapter text after the author may have edited it: the quote in its
// context, the quote alone, then a similar passage next to the context or the old place. Null
// means the note is orphaned.
export function anchorQuote(
  text: string,
  { quote, prefix, suffix, position }: QuoteAnchor,
): TextSpan | null {
  if (!quote) return null;
  const expected = Math.round(position * text.length);

  const full = nearest(text, prefix + quote + suffix, expected - prefix.length);
  if (full !== -1) {
    const start = full + prefix.length;
    return { start, end: start + quote.length };
  }
  const alone = nearest(text, quote, expected);
  if (
    alone !== -1 &&
    (quote.length >= SHORT_QUOTE_LENGTH ||
      Math.abs(alone - expected) <= SHORT_QUOTE_REACH)
  ) {
    return { start: alone, end: alone + quote.length };
  }

  const reach = Math.ceil(quote.length * 1.25);
  const areas: [number, number][] = [
    [expected - quote.length, expected + 2 * quote.length],
  ];
  const before = prefix ? nearest(text, prefix, expected - prefix.length) : 0;
  if (before !== -1) {
    const end = before + prefix.length;
    areas.push([end, end + reach]);
  }
  const after = suffix
    ? nearest(text, suffix, expected + quote.length)
    : text.length;
  if (after !== -1) areas.push([after - reach, after]);

  let found: { span: TextSpan; similarity: number } | null = null;
  for (const [from, to] of areas) {
    const match = bestMatch(quote, text, from, to);
    if (match && (!found || match.similarity > found.similarity)) found = match;
  }
  return found && found.similarity >= MIN_SIMILARITY ? found.span : null;
}
