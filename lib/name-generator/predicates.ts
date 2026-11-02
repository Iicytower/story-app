import { containsCrude } from "./crude";
import { COMMON_CLUSTERS, STYLE_TABLES } from "./data/styles";
import { STOP_WORDS } from "./data/types";
import { effectiveFilters, type Filters, type Style } from "./filters";
import {
  consonantRuns,
  isHard,
  isSoft,
  longestVowelRun,
  type Phoneme,
  syllableCount,
  tokenize,
} from "./phonemes";

export interface GeneratedName {
  text: string;
  // Every style a syllable or ending of this name came from.
  origins: Style[];
}

export function digraphsOf(styles: Style[]): string[] {
  return [...new Set(styles.flatMap((s) => STYLE_TABLES[s].digraphs))];
}

// The words that make the name itself: "Order of the Silver Sun" is "Silver Sun".
export function significantWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const kept = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  return kept.length > 0 ? kept : words;
}

export function soundScore(words: Phoneme[][]): number {
  const consonants = words.flat().filter((p) => !p.vowel);
  const hard = consonants.filter((p) => isHard(p.text)).length;
  const soft = consonants.filter((p) => isSoft(p.text)).length;
  return hard + soft === 0 ? 0 : (hard - soft) / (hard + soft);
}

export function soundClass(words: Phoneme[][]): "hard" | "soft" | "neutral" {
  const score = soundScore(words);
  if (score >= 0.33) return "hard";
  if (score <= -0.33) return "soft";
  return "neutral";
}

export function lengthClass(word: Phoneme[]): "short" | "medium" | "long" {
  const syllables = syllableCount(word);
  if (syllables <= 2) return "short";
  return syllables === 3 ? "medium" : "long";
}

export function vowelShare(words: Phoneme[][]): number {
  const all = words.flat();
  return all.length === 0 ? 0 : all.filter((p) => p.vowel).length / all.length;
}

export function balanceClass(
  words: Phoneme[][],
): "vowel-heavy" | "balanced" | "consonant-heavy" {
  const share = vowelShare(words);
  if (share >= 0.55) return "vowel-heavy";
  return share <= 0.35 ? "consonant-heavy" : "balanced";
}

const clusterCache = new Map<Style, Set<string>>();

function clustersOf(style: Style): Set<string> {
  const cached = clusterCache.get(style);
  if (cached) return cached;
  const table = STYLE_TABLES[style];
  const clusters = new Set(COMMON_CLUSTERS);
  const entries = [
    ...table.onsets,
    ...table.codas,
    ...table.male,
    ...table.female,
    ...table.neutral,
    ...table.surname,
    ...table.place,
    ...table.thing,
  ];
  for (const entry of entries) {
    for (const run of consonantRuns(tokenize(entry, table.digraphs))) {
      clusters.add(run.join(""));
    }
  }
  clusterCache.set(style, clusters);
  return clusters;
}

export function pronunciationClass(
  word: Phoneme[],
  styles: Style[],
): "easy" | "exotic" | "plain" | "unpronounceable" {
  const runs = consonantRuns(word);
  if (syllableCount(word) === 0 || runs.some((run) => run.length >= 4)) {
    return "unpronounceable";
  }
  const known = (run: string[]) =>
    run.length === 1 || styles.some((s) => clustersOf(s).has(run.join("")));
  if (runs.some((run) => !known(run))) return "exotic";
  return longestVowelRun(word) <= 2 ? "easy" : "plain";
}

export function hasRepeatedSyllable(word: Phoneme[]): boolean {
  const texts = word.map((p) => p.text);
  for (let i = 0; i < texts.length; i += 1) {
    for (let size = 2; i + size * 2 <= texts.length; size += 1) {
      const first = texts.slice(i, i + size).join("");
      const second = texts.slice(i + size, i + size * 2).join("");
      if (first === second && word.slice(i, i + size).some((p) => p.vowel)) {
        return true;
      }
    }
  }
  return false;
}

// Masculine: one consonant after a vowel. Feminine: -a after one or two consonants.
export function isEasyToInflect(word: string): boolean {
  return /[aeiouy][bdfgklłmnprstwz]$|[aeiouy][bcdfghklłmnprstwz]{1,2}a$/.test(
    word.toLowerCase(),
  );
}

export function endingsFor(styles: Style[], gender: Filters["gender"]) {
  if (gender === "any") return [];
  return styles.flatMap((style) => STYLE_TABLES[style][gender]);
}

function textMatches(text: string, f: Filters): boolean {
  const lower = text.toLowerCase();
  const fragments = f.excludes
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return (
    lower.startsWith(f.startsWith.trim().toLowerCase()) &&
    lower.endsWith(f.endsWith.trim().toLowerCase()) &&
    lower.includes(f.contains.trim().toLowerCase()) &&
    !fragments.some((fragment) => lower.includes(fragment))
  );
}

export function matchesFilters(name: GeneratedName, filters: Filters): boolean {
  const f = effectiveFilters(filters);
  const { text, origins } = name;
  if (!textMatches(text, f)) return false;
  if (!f.polishLetters && /[ąćęłńóśźż]/i.test(text)) return false;
  const marked = /['-]/.test(text);
  if (marked !== f.punctuation) return false;
  if (/\d/.test(text) && !origins.includes("scifi")) return false;
  if (f.styles.length > 0 && !origins.every((s) => f.styles.includes(s))) {
    return false;
  }
  if (!f.mixStyles && origins.length > 1) return false;

  const words = significantWords(text);
  const digraphs = digraphsOf(origins);
  const phonemes = words.map((word) => tokenize(word, digraphs));

  if (f.wordCount !== "any") {
    if (words.length !== { one: 1, two: 2, three: 3 }[f.wordCount]) {
      return false;
    }
  }
  if (f.alliteration) {
    const first = phonemes[0][0]?.text;
    if (words.length < 2 || phonemes.some((w) => w[0]?.text !== first)) {
      return false;
    }
  }
  if (f.gender !== "any") {
    const firstWord = words[0].toLowerCase();
    const endings = endingsFor(origins, f.gender);
    if (!endings.some((ending) => firstWord.endsWith(ending))) return false;
  }
  if (f.sound !== "any" && soundClass(phonemes) !== f.sound) return false;
  if (f.balance !== "any" && balanceClass(phonemes) !== f.balance) return false;
  if (f.length !== "any" && !phonemes.every((w) => lengthClass(w) === f.length))
    return false;
  if (f.repeatedSyllable && !phonemes.some(hasRepeatedSyllable)) return false;
  if (f.easyInflect && !isEasyToInflect(words[words.length - 1])) return false;

  if (f.pronunciation !== "any") {
    const classes = phonemes.map((w) => pronunciationClass(w, origins));
    const wanted =
      f.pronunciation === "easy"
        ? classes.every((c) => c === "easy")
        : f.pronunciation === "exotic"
          ? classes.includes("exotic") && !classes.includes("unpronounceable")
          : classes.includes("unpronounceable");
    if (!wanted) return false;
  }

  if (f.crude === "exclude" && containsCrude(text)) return false;
  if (f.crude === "only" && !containsCrude(text)) return false;
  return true;
}
