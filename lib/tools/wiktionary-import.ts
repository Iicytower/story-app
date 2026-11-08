// Turns entries of the Polish Wiktionary dump (kaikki.org/plwiktionary, wiktextract JSONL) into
// the definitions the dictionary service serves (task 32, D62). Used only by `npm run dict:build`.

// Wiktionary labels shown as chips (kaikki gives them as English tags); other tags and the
// topics are left out.
export const LABELS = [
  "colloquial",
  "obsolete",
  "dated",
  "literary",
  "rare",
  "dialectal",
  "regional",
  "vulgar",
  "humorous",
  "pejorative",
  "offensive",
  "slang",
  "diminutive",
  "augmentative",
  "endearing",
  "ironic",
  "euphemistic",
  "metaphoric",
  "formal",
  "neologism",
  "elevatedly",
  "poetic",
  "scornfully",
  "youth",
] as const;
export type Label = (typeof LABELS)[number];
const LABEL_SET: ReadonlySet<string> = new Set(LABELS);

export const MAX_EXAMPLES = 2;

export interface Sense {
  // Wiktionary's number ("1.2"), which glosses refer to ("miasta (1.1)").
  index: string;
  gloss: string;
  labels: Label[];
  // The region of a dialectal or regional sense.
  region?: string;
  examples: string[];
  // Kept only when the headword has nothing else, so the app can hide it next to the word it
  // points to (criterion 4).
  reference?: true;
}

export interface Entry {
  pos: string;
  // Wiktionary's Polish name of the part of speech, for codes the app has no label for.
  posTitle: string;
  senses: Sense[];
}

interface RawSense {
  glosses?: unknown;
  sense_index?: unknown;
  tags?: unknown;
  examples?: unknown;
}

interface RawEntry {
  word?: unknown;
  lang_code?: unknown;
  pos?: unknown;
  pos_title?: unknown;
  senses?: unknown;
}

// "gw. (Bukowina) targ", "reg. (Poznań) żwir": the label leaks into the gloss.
const DIALECT = /^(gw|reg)\.\s*\(([^()]+)\)\s*/u;
// "lm od: lut", "aspekt dokonany od: odczytywać", "od: ten": a pointer to another word, not a
// meaning of its own.
const REFERENCE = /^[\p{L} .]{0,25}?(?<!\p{L})od:\s/u;

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function isReference(sense: Sense): boolean {
  return REFERENCE.test(sense.gloss);
}

export function cleanSense(raw: RawSense): Sense | null {
  let gloss = clean(strings(raw.glosses).join(" "));
  const labels = new Set(strings(raw.tags).filter((tag) => LABEL_SET.has(tag)));
  let region: string | undefined;
  const dialect = DIALECT.exec(gloss);
  if (dialect) {
    labels.add(dialect[1] === "gw" ? "dialectal" : "regional");
    region = clean(dialect[2]);
    gloss = gloss.slice(dialect[0].length);
  }
  if (!gloss) return null;
  const examples = (Array.isArray(raw.examples) ? raw.examples : [])
    .map((example: { text?: unknown } | null) =>
      typeof example?.text === "string" ? clean(example.text) : "",
    )
    .filter(Boolean)
    .slice(0, MAX_EXAMPLES);
  return {
    index: typeof raw.sense_index === "string" ? raw.sense_index : "",
    gloss,
    labels: LABELS.filter((label) => labels.has(label)),
    ...(region && { region }),
    examples,
  };
}

// One line of the dump; null for other languages and entries without a meaning.
export function parseEntry(
  line: string,
): { word: string; entry: Entry } | null {
  const raw = JSON.parse(line) as RawEntry;
  if (raw.lang_code !== "pl" || typeof raw.word !== "string") return null;
  const word = raw.word.normalize("NFC").trim();
  const senses = (Array.isArray(raw.senses) ? raw.senses : [])
    .map((sense: RawSense) => cleanSense(sense ?? {}))
    .filter((sense): sense is Sense => sense !== null);
  if (!word || senses.length === 0) return null;
  return {
    word,
    entry: {
      pos: typeof raw.pos === "string" ? raw.pos : "unknown",
      posTitle: typeof raw.pos_title === "string" ? raw.pos_title : "",
      senses,
    },
  };
}

const isDialect = (sense: Sense) =>
  sense.labels.includes("dialectal") || sense.labels.includes("regional");

// All entries of a headword: references go when the headword has meanings of its own, and
// dialectal and regional senses come after the general ones (decisions of the user).
export function finishWord(entries: Entry[]): Entry[] {
  const hasMeaning = entries.some((entry) =>
    entry.senses.some((sense) => !isReference(sense)),
  );
  return entries
    .map((entry) => {
      const senses = hasMeaning
        ? entry.senses.filter((sense) => !isReference(sense))
        : entry.senses.map((sense) =>
            isReference(sense) ? { ...sense, reference: true as const } : sense,
          );
      return {
        ...entry,
        senses: [
          ...senses.filter((sense) => !isDialect(sense)),
          ...senses.filter(isDialect),
        ],
      };
    })
    .filter((entry) => entry.senses.length > 0);
}
