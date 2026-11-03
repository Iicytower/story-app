import {
  CRUDE_EXCEPTIONS,
  CRUDE_EXCLUDE_ONLY,
  CRUDE_ROOTS,
} from "./data/crude-roots";

// Phonetic rules run first: removing diacritics earlier would lose ó→u and rz→ż.
const PHONETIC_RULES: [RegExp, string][] = [
  [/ch/g, "h"],
  [/ó/g, "u"],
  [/rz/g, "ż"],
  [/kh/g, "h"],
  [/ya/g, "ja"],
  [/yo/g, "jo"],
  [/yu/g, "ju"],
];

export function normalizeCrude(text: string): string {
  let result = text.toLowerCase();
  for (const [from, to] of PHONETIC_RULES) result = result.replace(from, to);
  return result
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/(.)\1+/g, "$1");
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length < b.length
    ? a.slice(i) === b.slice(i + 1)
    : a.slice(i + 1) === b.slice(i);
}

const ROOTS = [...CRUDE_ROOTS, ...CRUDE_EXCLUDE_ONLY].map(normalizeCrude);
const EXCEPTIONS = CRUDE_EXCEPTIONS.map(normalizeCrude);

function hasRoot(word: string): boolean {
  for (const root of ROOTS) {
    if (root.length < 4) {
      if (word.includes(root)) return true;
      continue;
    }
    for (let length = root.length - 1; length <= root.length + 1; length += 1) {
      for (let i = 0; i + length <= word.length; i += 1) {
        if (withinOneEdit(word.slice(i, i + length), root)) return true;
      }
    }
  }
  return false;
}

export function containsCrude(text: string): boolean {
  return text.split(/\s+/).some((word) => {
    let normalized = normalizeCrude(word).replace(/[^a-z]/g, "");
    for (const exception of EXCEPTIONS) {
      normalized = normalized.replaceAll(exception, "-");
    }
    return normalized.split("-").some(hasRoot);
  });
}
