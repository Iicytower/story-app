export type FindOptions = {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type Match = { from: number; to: number };

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `\b` knows ASCII only, so it would treat "ą" as the end of a word.
const WORD_CHAR = "[\\p{L}\\p{N}_]";

export function compileFind(options: FindOptions): RegExp | "invalid" | null {
  if (!options.query) return null;
  const source = options.regex ? options.query : escapeRegex(options.query);
  const bounded = options.wholeWord
    ? `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`
    : source;
  try {
    return new RegExp(bounded, options.matchCase ? "gmu" : "gimu");
  } catch {
    return "invalid";
  }
}

export function findMatches(text: string, regex: RegExp): Match[] {
  const matches: Match[] = [];
  for (const match of text.matchAll(regex)) {
    // A pattern such as `a*` also matches nothing between letters.
    if (match[0])
      matches.push({ from: match.index, to: match.index + match[0].length });
  }
  return matches;
}

// The first match at or after the caret, wrapping to the first one.
export function nearestMatch(matches: Match[], position: number): number {
  const index = matches.findIndex((match) => match.from >= position);
  return index === -1 ? 0 : index;
}

// Only regex mode reads `$1`; a plain replacement is inserted as typed.
export function replacementTemplate(
  options: FindOptions,
  replacement: string,
): string {
  return options.regex ? replacement : replacement.replaceAll("$", "$$$$");
}

// Runs on the whole text, not the match alone, so lookaround and `^` see what they saw when finding.
export function expandMatch(
  text: string,
  { from, to }: Match,
  regex: RegExp,
  template: string,
): string {
  const sticky = new RegExp(regex.source, regex.flags.replace("g", "") + "y");
  sticky.lastIndex = from;
  const replaced = text.replace(sticky, template);
  return replaced.slice(from, replaced.length - (text.length - to));
}

export function replaceMatches(
  text: string,
  matches: Match[],
  regex: RegExp,
  template: string,
): string {
  let result = "";
  let last = 0;
  for (const match of matches) {
    result +=
      text.slice(last, match.from) + expandMatch(text, match, regex, template);
    last = match.to;
  }
  return result + text.slice(last);
}
