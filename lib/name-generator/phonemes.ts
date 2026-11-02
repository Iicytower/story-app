export const PL_DIGRAPHS = ["sz", "cz", "rz", "ch", "dz", "dż", "dź"];
export const EN_DIGRAPHS = ["th", "ph", "sh", "ch", "ck", "gh", "kh"];

export interface Phoneme {
  text: string;
  vowel: boolean;
}

const VOWELS = new Set("aeiouyąęó");

const HARD = new Set(
  "p b t d k g c ć q x r ck cz dz dż dź ż rz sz sh kh".split(" "),
);
const SOFT = new Set("l ł m n ń j w v f h s ś ź ch th ph gh".split(" "));

// Letters only: an apostrophe or a digit is not a sound.
export function tokenize(text: string, digraphs: string[]): Phoneme[] {
  const letters = [...text.toLowerCase()].filter((c) => /\p{L}/u.test(c));
  const phonemes: Phoneme[] = [];
  for (let i = 0; i < letters.length; i += 1) {
    const pair = letters[i] + (letters[i + 1] ?? "");
    if (digraphs.includes(pair)) {
      phonemes.push({ text: pair, vowel: false });
      i += 1;
      continue;
    }
    const letter = letters[i];
    // "Yara" starts with a consonant, "Lyra" has y as its vowel.
    const glide = letter === "y" && VOWELS.has(letters[i + 1] ?? "");
    phonemes.push({ text: letter, vowel: VOWELS.has(letter) && !glide });
  }
  return phonemes;
}

export function isHard(phoneme: string): boolean {
  return HARD.has(phoneme);
}

export function isSoft(phoneme: string): boolean {
  return SOFT.has(phoneme);
}

// One syllable per group of adjacent vowels.
export function syllableCount(phonemes: Phoneme[]): number {
  return phonemes.filter((p, i) => p.vowel && !phonemes[i - 1]?.vowel).length;
}

export function consonantRuns(phonemes: Phoneme[]): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];
  for (const phoneme of phonemes) {
    if (!phoneme.vowel) {
      run.push(phoneme.text);
      continue;
    }
    if (run.length > 0) runs.push(run);
    run = [];
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

export function longestVowelRun(phonemes: Phoneme[]): number {
  let longest = 0;
  let run = 0;
  for (const phoneme of phonemes) {
    run = phoneme.vowel ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}
