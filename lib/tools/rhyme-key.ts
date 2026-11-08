// Phonetic transcription and rhyme keys of Polish words (task 34). Each phone is one character:
// vowels a e i o u y ą ę; č š ž for cz sz ż, x for h/ch, w for ł, v for w, ʣ ʥ ʤ for dz dź dż.
// The app and `dict:build` share it, so a typed word gets the keys its form has in the table.

const VOWELS = new Set("aeiouyąę");
const ORTHOGRAPHIC_VOWELS = new Set("aeiouyąęó");

// Voiced obstruent → voiceless.
const DEVOICED: Record<string, string> = {
  b: "p",
  d: "t",
  g: "k",
  v: "f",
  z: "s",
  ź: "ś",
  ž: "š",
  ř: "š",
  ʣ: "c",
  ʥ: "ć",
  ʤ: "č",
};
const VOICED: Record<string, string> = Object.fromEntries(
  Object.entries(DEVOICED)
    .filter(([voiced]) => voiced !== "ř")
    .map(([voiced, voiceless]) => [voiceless, voiced]),
);
const OBSTRUENTS = new Set([
  ...Object.keys(DEVOICED),
  ...Object.values(DEVOICED),
  "x",
]);

// Consonants i softens to its soft counterpart instead of adding j (rule 3).
const SOFTENED: Record<string, string> = {
  n: "ń",
  s: "ś",
  z: "ź",
  c: "ć",
  ʣ: "ʥ",
};

// Spellings of loanwords read otherwise; the stem may take any ending.
const LOAN_SPELLINGS: [RegExp, string][] = [
  [/pizz/g, "pic"],
  [/boss/g, "bos"],
  [/cast/g, "kast"],
  [/^jazz/g, "dżez"],
];
// Loanwords in -nia whose i is /j/ (mania: mańja, unlike tania).
const LOAN_NIA =
  /(^mani|omani|harmoni|^ironi|agoni|^koloni|^lini|^foni|ofoni|ceremoni|kompani|hiszpani|brytani|germani|kaliforni|begoni|pelargoni|petuni|insomni|pneumoni)(?=[aeouąę])/;
// rz read as r+z (zamarzać, marznąć).
const RZ_APART = /(^|za|od|przy|ob|prze|do|na|wy|z)marz(?=n|a|ł|l)|marzn/;
// au and eu are one syllable but for a native prefix (nauka, nieufny) and the endings below.
const PREFIX_BEFORE_U = /^(nie)?(na|za|prze)$|^nie$/;
// -eum, -eus, -eusz with their endings are two syllables (muzeum, Tadeusz, Mateusza).
const HIATUS_ENDING = /^u(m|s|sz)(a|e|owi|em|u|y|ów|ach|ami|om)?$/;

function spelling(word: string): string {
  let text = word
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("é", "e")
    .replaceAll("q", "k")
    .replaceAll("x", "ks")
    .replace(/[^a-ząćęłńóśźżv]/g, "");
  for (const [pattern, replacement] of LOAN_SPELLINGS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

// Letters to phones (rules 1–4), without the nasals and voicing.
function letters(text: string): string[] {
  const phones: string[] = [];
  const loanNia = LOAN_NIA.exec(text);
  const loanJ = loanNia ? loanNia.index + loanNia[0].length - 1 : -1;
  const rzApart = RZ_APART.exec(text);
  const apart = rzApart ? text.indexOf("rz", rzApart.index) : -1;
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    let phone: string;
    if (text.startsWith("dż", i)) phone = "ʤ";
    else if (text.startsWith("dź", i)) phone = "ʥ";
    else if (two === "dz") phone = "ʣ";
    else if (two === "cz") phone = "č";
    else if (two === "sz") phone = "š";
    else if (two === "rz" && i !== apart) phone = "ř";
    else if (two === "ch") phone = "x";
    else phone = "";
    if (phone) i += 2;
    else {
      phone = { ł: "w", h: "x", ó: "u", w: "v", ż: "ž" }[text[i]] ?? text[i];
      i += 1;
    }

    if (text[i] === "i" && !VOWELS.has(phone)) {
      const next = text[i + 1];
      const beforeVowel = next !== undefined && ORTHOGRAPHIC_VOWELS.has(next);
      const soft = SOFTENED[phone];
      if (beforeVowel) {
        // i only marks softness, or is /j/.
        phones.push(soft ?? phone);
        if (!soft || i === loanJ) phones.push("j");
        i += 1;
        continue;
      }
      phones.push(soft ?? phone);
      continue;
    }

    if (
      (phone === "a" || phone === "e") &&
      text[i] === "u" &&
      !PREFIX_BEFORE_U.test(text.slice(0, i)) &&
      !HIATUS_ENDING.test(text.slice(i))
    ) {
      phones.push(phone, "w");
      i += 1;
      continue;
    }
    phones.push(phone);
  }
  return phones;
}

// Nasal vowels by the next phone (rule 5).
function nasals(phones: string[]): string[] {
  const result: string[] = [];
  phones.forEach((phone, index) => {
    if (phone !== "ą" && phone !== "ę") {
      result.push(phone);
      return;
    }
    const oral = phone === "ą" ? "o" : "e";
    const next = phones[index + 1];
    if (next === undefined) result.push(phone === "ą" ? "ą" : "e");
    else if ("pb".includes(next)) result.push(oral, "m");
    else if ("tdcʣčʤkg".includes(next)) result.push(oral, "n");
    else if ("ćʥ".includes(next)) result.push(oral, "ń");
    else if ("lw".includes(next)) result.push(oral);
    else result.push(phone);
  });
  return result;
}

// Voicing (rule 6): from the right, a word-final obstruent is voiceless and a cluster takes the
// voicing of its last obstruent; v and rz take it but do not pass it on, and are f and sz after a
// voiceless obstruent.
function voicing(phones: string[]): string[] {
  const result = [...phones];
  let next: "voiced" | "voiceless" | null = "voiceless";
  for (let index = result.length - 1; index >= 0; index--) {
    const phone = result[index];
    if (!OBSTRUENTS.has(phone)) {
      next = null;
      continue;
    }
    if (next === "voiceless") result[index] = DEVOICED[phone] ?? phone;
    else if (next === "voiced" && phone !== "ř") {
      result[index] = VOICED[phone] ?? phone;
    }
    if (phone === "v" || phone === "ř") continue;
    next = result[index] in DEVOICED ? "voiced" : "voiceless";
  }
  for (let index = 1; index < result.length; index++) {
    const phone = result[index];
    if (
      (phone === "v" || phone === "ř") &&
      OBSTRUENTS.has(result[index - 1]) &&
      !(result[index - 1] in DEVOICED)
    ) {
      result[index] = DEVOICED[phone];
    }
  }
  return result.map((phone) => (phone === "ř" ? "ž" : phone));
}

export function transcribe(word: string): string[] {
  return voicing(nasals(letters(spelling(word))));
}

// Syllables of a transcription (task 35): its vowels, as a softening i is no phone of its own.
export const syllableCount = (phones: string) =>
  [...phones].filter((phone) => VOWELS.has(phone)).length;

// Stress (rule 7): the vowel the tail starts from, counted from the end. Conditional and
// past-tense endings move it back only in verbs; the tag says whether the form is one, and a
// word not in the table is taken for a verb.
const FOURTH = /(li|ły)by(śmy|ście)$/;
const THIRD = /ł[aoy]by[mś]?$|liby$|(li|ły)(śmy|ście)$/;
const THIRD_ALWAYS = /^(że|a|gdy|jak|choć)by(śmy|ście)$/;

function stressedVowel(word: string, verb: boolean): number {
  const text = spelling(word);
  if (THIRD_ALWAYS.test(text)) return 3;
  if (!verb) return 2;
  if (FOURTH.test(text)) return 4;
  if (THIRD.test(text)) return 3;
  return 2;
}

// Tags of PoliMorf that make a form a verb for the stress rules.
export const isVerbTag = (tag: string) =>
  tag.startsWith("cond:") || tag.startsWith("praet:");

export interface RhymeKeys {
  // The whole transcription, for the longest common ending.
  phones: string;
  // From the stressed vowel to the end.
  exact: string;
  // The exact key with i=y, final ą=o and consonants by class.
  near: string;
  // The last syllable, with i=y and final ą=o; with an open ending the consonant before the
  // vowel is part of it. null when an open ending has no consonant before its vowel.
  last: string | null;
}

const CLASSES: Record<string, string> = Object.fromEntries(
  [
    ["P", "pbtdkg"],
    ["F", "fvszśźšžx"],
    ["C", "cćčʣʥʤ"],
    ["N", "mnń"],
    ["L", "lr"],
    ["J", "wj"],
  ].flatMap(([name, phones]) => [...phones].map((phone) => [phone, name])),
);

const vowelsAlike = (phones: string[]) =>
  phones.map((phone, index) =>
    phone === "i"
      ? "y"
      : phone === "ą" && index === phones.length - 1
        ? "o"
        : phone,
  );

function nearKey(tail: string[]): string {
  const classes = vowelsAlike(tail).map((phone) => CLASSES[phone] ?? phone);
  // A run of consonants of one class (upper case) counts as one.
  return classes
    .filter(
      (phone, index) =>
        phone === phone.toLowerCase() || classes[index - 1] !== phone,
    )
    .join("");
}

// Keys of a word; null without a vowel (an abbreviation, "w").
export function rhymeKeys(word: string, verb = true): RhymeKeys | null {
  const phones = transcribe(word);
  const vowels = phones.flatMap((phone, index) =>
    VOWELS.has(phone) ? [index] : [],
  );
  if (vowels.length === 0) return null;
  const stressed =
    vowels[Math.max(0, vowels.length - stressedVowel(word, verb))];
  const tail = phones.slice(stressed);
  const lastVowel = vowels.at(-1)!;
  const open = lastVowel === phones.length - 1;
  const last = !open
    ? vowelsAlike(phones.slice(lastVowel)).join("")
    : lastVowel > 0 && !VOWELS.has(phones[lastVowel - 1])
      ? vowelsAlike(phones.slice(lastVowel - 1)).join("")
      : null;
  return {
    phones: phones.join(""),
    exact: tail.join(""),
    near: nearKey(tail),
    last,
  };
}
