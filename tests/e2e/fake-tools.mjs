// Stands in for the tools server (D56) in E2E: answers LanguageTool's /v2/check from a
// fixed list of words, so results do not depend on a running LT, and the dictionary service's
// /dict/lemmas, /dict/definitions, /dict/synonyms and /dict/rhymes from a small form table
// (task 25), a few entries (task 32), synonyms (task 33) and rhymes (task 34). Markers in the
// text or the looked-up word: AWARIA answers 503, POWOLI answers after a delay.
import { createServer } from "node:http";

const [port, secret] = process.argv.slice(2);

// Word → LT match fields (case-sensitive). An empty list is an issue without suggestions.
const ISSUES = {
  Napewno: {
    replacements: ["Na pewno", "Napewnie"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  // The same typo in capitals, for the dictionary (task 30).
  NAPEWNO: {
    replacements: ["NA PEWNO"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  Wogóle: {
    replacements: ["W ogóle"],
    category: "TYPOS",
    message: "Wykryto prawdopodobny błąd pisowni",
  },
  tą: {
    replacements: ["tę"],
    category: "GRAMMAR",
    message: "W bierniku zaimek „ta” ma formę „tę”.",
  },
  dobry: {
    replacements: [],
    category: "MISC",
    message: "Powtórzony wyraz w zdaniu",
  },
};

// Form → lemma rows, as the dictionary service answers them (task 25).
const FORMS = [
  { form: "kota", lemma: "kot" },
  { form: "kota", lemma: "kota" },
  { form: "Kota", lemma: "Kot" },
  { form: "psa", lemma: "pies" },
  { form: "tego", lemma: "ten" },
];

const sense = (index, gloss, extra = {}) => ({
  index,
  gloss,
  labels: [],
  examples: [],
  ...extra,
});

// Headword → entries, as built from Wikisłownik (task 32).
const ENTRIES = {
  kot: [
    {
      pos: "noun",
      posTitle: "rzeczownik",
      senses: [
        sense("1.1", "zwierzę domowe", { examples: ["Kot goni za myszą."] }),
        sense("1.4", "kłąb kurzu", { labels: ["colloquial"] }),
        sense("1.6", "kotwica", { labels: ["dialectal"], region: "Kaszuby" }),
      ],
    },
  ],
  Kot: [
    {
      pos: "name",
      posTitle: "nazwa własna",
      senses: [sense("1.1", "nazwisko")],
    },
  ],
  ten: [
    {
      pos: "pron",
      posTitle: "zaimek",
      senses: [sense("1.1", "wskazuje na osobę lub rzecz")],
    },
  ],
  tego: [
    {
      pos: "pron",
      posTitle: "zaimek",
      senses: [sense("1.1", "od: ten", { reference: true })],
    },
  ],
};

const synonym = (word, labels = [], extra = {}) => ({ word, labels, ...extra });

// Headword → synonyms of each source, as built (task 33). "sierściuch" is in both, with
// different labels.
const SYNONYMS = {
  wiktionary: {
    kot: [
      {
        pos: "noun",
        posTitle: "rzeczownik",
        senses: [
          {
            index: "1.1",
            gloss: "zwierzę domowe",
            synonyms: [
              synonym("dachowiec"),
              synonym("sierściuch", ["scornfully"]),
              synonym("kociamber", ["dialectal"], { region: "Poznań" }),
            ],
          },
          {
            index: "1.4",
            gloss: "kłąb kurzu",
            synonyms: [synonym("farfocel")],
          },
        ],
      },
    ],
  },
  thesaurus: {
    kot: [
      [
        synonym("dachowiec"),
        synonym("sierściuch", ["colloquial"]),
        synonym("mruczek", ["endearing"]),
      ],
    ],
    pies: [[synonym("kundel", ["veryColloquial"])]],
  },
};

function matches(annotation) {
  const found = [];
  let offset = 0;
  for (const part of annotation) {
    if ("text" in part) {
      for (const [word, issue] of Object.entries(ISSUES)) {
        for (const match of part.text.matchAll(
          new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "gu"),
        ))
          found.push({
            message: issue.message,
            offset: offset + match.index,
            length: word.length,
            replacements: issue.replacements.map((value) => ({ value })),
            rule: { id: `FAKE_${word}`, category: { id: issue.category } },
          });
      }
      offset += part.text.length;
    } else {
      offset += part.markup.length;
    }
  }
  return found.sort((a, b) => a.offset - b.offset);
}

// Spelling → rows of each rhyme level, as built (task 34), with parts of speech (1 noun,
// 2 adjective, 4 verb, 16 other) and syllables the filters of task 35 narrow by. Frequencies are
// Zipf × 100: "wrota" is rare and "ta" a function word, so both wait behind "Show more".
const rhyme = (form, phones, pos, syllables, freq = 400, flags = 0) => ({
  form,
  phones,
  freq,
  lemmas: form,
  flags,
  pos,
  syllables,
});
const RHYMES = {
  kota: {
    self: [
      { ...rhyme("kota", "kota", 1, 2), exact: "ota", near: "oPa", last: "ta" },
    ],
    exact: [
      rhyme("kota", "kota", 1, 2),
      rhyme("złota", "zwota", 3, 2, 450),
      rhyme("robota", "robota", 1, 3, 430),
      rhyme("wrota", "vrota", 1, 2, 200),
    ],
    near: [rhyme("woda", "voda", 1, 2)],
    last: [rhyme("lata", "lata", 5, 2), rhyme("ta", "ta", 16, 1, 800, 1)],
  },
};

// The filters as the service applies them in SQL; self rows stay.
function filterRhymes(answer, { pos, min, max } = {}) {
  const fits = (row) =>
    (pos === undefined || (row.pos & pos) !== 0) &&
    (min === undefined || row.syllables >= min) &&
    (max === undefined || row.syllables <= max);
  const level = (rows) => rows.filter(fits);
  return {
    ...answer,
    exact: level(answer.exact),
    near: level(answer.near),
    last: level(answer.last),
  };
}

createServer(async (request, response) => {
  if (request.url === "/") return response.end("ok");
  if (request.headers["x-tools-secret"] !== secret) {
    response.statusCode = 401;
    return response.end();
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.url.startsWith("/dict/")) {
    const { forms, filters } = JSON.parse(body);
    if (forms.some((form) => form.includes("AWARIA"))) {
      response.statusCode = 503;
      return response.end();
    }
    if (forms.some((form) => form.includes("POWOLI")))
      await new Promise((resolve) => setTimeout(resolve, 4000));
    const lemmas = {
      source: "polimorf",
      rows: FORMS.filter(({ form }) => forms.includes(form)),
    };
    const words = [...forms, ...lemmas.rows.map(({ lemma }) => lemma)];
    const rows = (table, field) =>
      Object.entries(table)
        .filter(([word]) => words.includes(word))
        .map(([word, data]) => ({ word, [field]: data }));
    const answers = {
      "/dict/lemmas": lemmas,
      "/dict/definitions": {
        lemmas,
        definitions: { source: "wiktionary", rows: rows(ENTRIES, "entries") },
      },
      "/dict/rhymes": filterRhymes(
        {
          source: "rhymes",
          self: [],
          exact: [],
          near: [],
          last: [],
          ...RHYMES[forms.find((form) => RHYMES[form])],
        },
        filters,
      ),
      "/dict/synonyms": {
        lemmas,
        synonyms: {
          wiktionary: rows(SYNONYMS.wiktionary, "entries"),
          thesaurus: rows(SYNONYMS.thesaurus, "senses"),
        },
      },
    };
    if (!answers[request.url]) {
      response.statusCode = 404;
      return response.end();
    }
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify(answers[request.url]));
  }
  const { annotation } = JSON.parse(new URLSearchParams(body).get("data"));
  const text = annotation.map((part) => part.text ?? "").join("");
  if (text.includes("AWARIA")) {
    response.statusCode = 503;
    return response.end();
  }
  if (text.includes("POWOLI"))
    await new Promise((resolve) => setTimeout(resolve, 4000));
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ matches: matches(annotation) }));
}).listen(Number(port), "127.0.0.1");
