// Dictionary databases: `npm run dict:build [forms|definitions|synonyms|rhymes]` builds the form
// table from PoliMorf into .tools/dict/forms.sqlite (task 25, D61), the definitions from the
// Polish Wiktionary into .tools/dict/definitions.sqlite (task 32, D62), the synonyms of
// Wiktionary and the Dobry słownik thesaurus into .tools/dict/synonyms.sqlite (task 33, D63) and
// the rhyme keys of the form table with wordfreq's frequencies into .tools/dict/rhymes.sqlite
// (task 34, D64); without an argument all. `npm run dict:upload [forms|definitions|synonyms|rhymes]`
// sends the built files (without an argument all) to the dictionary service on the local tools
// server. Source data and the built files stay out of the repo (licences: D61–D64).
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { DatabaseSync } from "node:sqlite";
import { createGunzip, gunzipSync } from "node:zlib";
import { strFromU8, unzipSync } from "fflate";
import { isVerbTag, rhymeKeys } from "../lib/tools/rhyme-key";
import { formFlags, wordFrequencies } from "../lib/tools/rhymes-import";
import { SOURCES } from "../lib/tools/sources";
import {
  decodeThesaurus,
  parseSynonymEntry,
  parseThesaurus,
  thesaurusLicence,
  type SynonymEntry,
  type ThesaurusSense,
} from "../lib/tools/synonyms-import";
import {
  finishWord,
  parseEntry,
  type Entry,
} from "../lib/tools/wiktionary-import";

const ROOT = process.cwd();
const DICT_DIR = path.join(ROOT, ".tools/dict");
const SOURCE_FILE = path.join(DICT_DIR, "src/polimorf-20261018.tab.gz");
const DATABASE = path.join(DICT_DIR, "forms.sqlite");
const DEFINITIONS = path.join(DICT_DIR, "definitions.sqlite");
const SYNONYMS = path.join(DICT_DIR, "synonyms.sqlite");
const RHYMES = path.join(DICT_DIR, "rhymes.sqlite");
const TOOLS_ENV = path.join(ROOT, ".tools/tools.env");
const TOOLS_API_URL = "http://127.0.0.1:8110";

const SOURCE = {
  id: "polimorf",
  version: "2026-10-18",
  url: "https://download.sgjp.pl/morfeusz/20261018/polimorf-20261018.tab.gz",
  sha256: "50ca3f3b569115f31556380477ff0bccea858e30aff5a73764f747307790966c",
};

async function fetchSource() {
  fs.mkdirSync(path.dirname(SOURCE_FILE), { recursive: true });
  console.log("Fetching PoliMorf…");
  const response = await fetch(SOURCE.url);
  if (!response.ok) throw new Error(`PoliMorf: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(data).digest("hex");
  if (hash !== SOURCE.sha256) throw new Error("PoliMorf: wrong checksum.");
  fs.writeFileSync(SOURCE_FILE, data);
}

// The file opens with the licence between #<COPYRIGHT> and #</COPYRIGHT>, which is kept in meta.
type Row = { form: string; lemma: string; tag: string } | { licence: string };

async function* polimorf(): AsyncGenerator<Row> {
  const lines = readline.createInterface({
    input: fs.createReadStream(SOURCE_FILE).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let licence: string[] | null = null;
  for await (const line of lines) {
    if (line === "#<COPYRIGHT>") licence = [];
    else if (line === "#</COPYRIGHT>" && licence) {
      yield { licence: licence.join("\n").trim() };
      licence = null;
    } else if (licence) licence.push(line);
    if (licence || line.startsWith("#")) continue;
    // form, lemma, tag, name type, qualifiers
    const [form, lemma, tag] = line.split("\t");
    if (form && lemma && tag) yield { form, lemma, tag };
  }
}

async function buildForms() {
  if (!fs.existsSync(SOURCE_FILE)) await fetchSource();
  const temporary = `${DATABASE}.tmp`;
  fs.rmSync(temporary, { force: true });
  const db = new DatabaseSync(temporary);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE lemmas (id INTEGER PRIMARY KEY, lemma TEXT NOT NULL UNIQUE);
    CREATE TABLE tags (id INTEGER PRIMARY KEY, tag TEXT NOT NULL UNIQUE);
    -- One row per form, lemma and tag (PoliMorf repeats rows of homonyms); the key is the
    -- lookup by form.
    CREATE TABLE forms (
      form TEXT NOT NULL,
      lemma_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (form, lemma_id, tag_id)
    ) WITHOUT ROWID;
  `);
  const insertLemma = db.prepare("INSERT INTO lemmas VALUES (?, ?)");
  const insertTag = db.prepare("INSERT INTO tags VALUES (?, ?)");
  const insertForm = db.prepare("INSERT OR IGNORE INTO forms VALUES (?, ?, ?)");
  const lemmaIds = new Map<string, number>();
  const tagIds = new Map<string, number>();
  const idOf = (
    ids: Map<string, number>,
    insert: typeof insertLemma,
    value: string,
  ) => {
    let id = ids.get(value);
    if (id === undefined) {
      id = ids.size + 1;
      ids.set(value, id);
      insert.run(id, value);
    }
    return id;
  };

  console.log(`Building ${path.relative(ROOT, DATABASE)}…`);
  let licence = "";
  db.exec("BEGIN");
  for await (const row of polimorf()) {
    if ("licence" in row) {
      licence = row.licence;
      continue;
    }
    insertForm.run(
      row.form.normalize("NFC"),
      idOf(lemmaIds, insertLemma, row.lemma.normalize("NFC")),
      idOf(tagIds, insertTag, row.tag),
    );
  }
  if (!licence) throw new Error("PoliMorf: licence header not found.");
  db.exec("CREATE INDEX forms_lemma ON forms (lemma_id)");
  const { forms } = db.prepare("SELECT count(*) AS forms FROM forms").get() as {
    forms: number;
  };
  const insertMeta = db.prepare("INSERT INTO meta VALUES (?, ?)");
  for (const [key, value] of Object.entries({
    source: SOURCE.id,
    version: SOURCE.version,
    licence,
    builtAt: new Date().toISOString(),
    forms: String(forms),
  })) {
    insertMeta.run(key, value);
  }
  db.exec("COMMIT");
  db.exec("VACUUM");
  db.close();
  fs.renameSync(temporary, DATABASE);
  console.log(
    `Done: ${forms} rows, ${lemmaIds.size} lemmas, ${tagIds.size} tags, ${Math.round(fs.statSync(DATABASE).size / 1e6)} MB.`,
  );
}

// Kaikki and Dobry słownik serve only the latest file (updated weekly and quarterly), so a
// downloaded file is kept under the date of its Last-Modified header and builds use the newest
// kept file; `--refresh` fetches the current one. Wiktionary's text is CC BY-SA 4.0 (D62), the
// thesaurus LGPL 2.1 (D63).
const WIKTIONARY = {
  id: "wiktionary",
  url: "https://kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz",
  file: /^plwiktionary-(\d{8})\.jsonl\.gz$/,
  name: (date: string) => `plwiktionary-${date}.jsonl.gz`,
  licence: "CC BY-SA 4.0",
};
const THESAURUS = {
  id: "dobryslownik",
  url: "https://pobierz.dobryslownik.pl/pl-dict-latest.oxt",
  file: /^dobryslownik-(\d{8})\.oxt$/,
  name: (date: string) => `dobryslownik-${date}.oxt`,
  licence: "LGPL 2.1",
};
const SRC_DIR = path.join(DICT_DIR, "src");

async function latestFile(
  source: {
    id: string;
    url: string;
    file: RegExp;
    name: (date: string) => string;
  },
  refresh: boolean,
): Promise<{ file: string; version: string }> {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  const version = (file: string) =>
    source.file
      .exec(path.basename(file))![1]
      .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const kept = fs
    .readdirSync(SRC_DIR)
    .filter((name) => source.file.test(name))
    .sort();
  if (kept.length > 0 && !refresh) {
    const file = path.join(SRC_DIR, kept.at(-1)!);
    return { file, version: version(file) };
  }
  console.log(`Fetching ${source.url}…`);
  const response = await fetch(source.url);
  const modified = response.headers.get("last-modified");
  if (!response.ok || !response.body || !modified) {
    throw new Error(`${source.id}: HTTP ${response.status}`);
  }
  const date = new Date(modified)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const file = path.join(SRC_DIR, source.name(date));
  if (fs.existsSync(file)) {
    await response.body.cancel();
    return { file, version: version(file) };
  }
  const temporary = `${file}.tmp`;
  await pipeline(
    // DOM and Node typings of the same stream differ.
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    fs.createWriteStream(temporary),
  );
  fs.renameSync(temporary, file);
  return { file, version: version(file) };
}

const sha256 = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

// Lines of the Polish entries of the Wiktionary dump.
// The hash of the file is taken while it is read.
async function* wiktionaryLines(
  file: string,
  hash: ReturnType<typeof createHash>,
): AsyncGenerator<string> {
  console.log(`Reading ${path.relative(ROOT, file)}…`);
  const input = fs.createReadStream(file);
  input.on("data", (chunk) => hash.update(chunk));
  const lines = readline.createInterface({
    input: input.pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    // Cheap check first: most of the million lines are other languages.
    if (line.includes('"lang_code": "pl"')) yield line;
  }
}

// A new SQLite file next to the target, renamed over it when complete.
function newDatabase(target: string, schema: string) {
  const temporary = `${target}.tmp`;
  fs.rmSync(temporary, { force: true });
  const db = new DatabaseSync(temporary);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ${schema}
  `);
  db.exec("BEGIN");
  return {
    db,
    finish(meta: Record<string, string>) {
      const insertMeta = db.prepare("INSERT INTO meta VALUES (?, ?)");
      for (const [key, value] of Object.entries({
        ...meta,
        builtAt: new Date().toISOString(),
      })) {
        insertMeta.run(key, value);
      }
      db.exec("COMMIT");
      db.exec("VACUUM");
      db.close();
      fs.renameSync(temporary, target);
    },
  };
}

interface Thesaurus {
  senses: Map<string, ThesaurusSense[]>;
  version: string;
  sha256: string;
  dataSha256: string;
  licence: string;
}

// The thesaurus and its licence from the Dobry słownik package for LibreOffice, whose README
// gives the thesaurus LGPL 2.1 (D63). The notice shown in the app must match its copyright lines.
async function readThesaurus(refresh: boolean): Promise<Thesaurus> {
  const { file, version } = await latestFile(THESAURUS, refresh);
  const files = unzipSync(fs.readFileSync(file), {
    filter: ({ name }) =>
      name === "th_pl_PL_v2.dat" || name === "README_en.txt",
  });
  const data = files["th_pl_PL_v2.dat"];
  const readme = files["README_en.txt"];
  if (!data?.length || !readme?.length) {
    throw new Error("Dobry słownik: no thesaurus in the package.");
  }
  const licence = thesaurusLicence(
    strFromU8(readme),
    SOURCES.dobryslownik.copyright!,
  );
  return {
    senses: parseThesaurus(decodeThesaurus(data)),
    version,
    sha256: sha256(fs.readFileSync(file)),
    dataSha256: sha256(data),
    licence,
  };
}

// Definitions (task 32, D62) and synonyms (task 33, D63) come from one pass over the dump, so
// both are of the same version; `--refresh` therefore always rebuilds both.
async function buildWiktionary(
  targets: { definitions: boolean; synonyms: boolean },
  refresh: boolean,
) {
  const wiktionary = await latestFile(WIKTIONARY, refresh);
  // Before the long read, so a changed package stops the build at once.
  const thesaurus = targets.synonyms ? await readThesaurus(refresh) : null;
  // Entries of one headword can be far apart in the dump; Map keeps the dump's order.
  const definitions = new Map<string, Entry[]>();
  const synonyms = new Map<string, SynonymEntry[]>();
  const add = <T>(words: Map<string, T[]>, word: string, entry: T) => {
    const entries = words.get(word);
    if (entries) entries.push(entry);
    else words.set(word, [entry]);
  };
  const hash = createHash("sha256");
  for await (const line of wiktionaryLines(wiktionary.file, hash)) {
    const definition = targets.definitions && parseEntry(line);
    if (definition) add(definitions, definition.word, definition.entry);
    const synonym = targets.synonyms && parseSynonymEntry(line);
    if (synonym) add(synonyms, synonym.word, synonym.entry);
  }
  const wiktionaryHash = hash.digest("hex");

  if (targets.definitions) {
    const { db, finish } = newDatabase(
      DEFINITIONS,
      `-- All entries of a headword as JSON, in the dump's order.
      CREATE TABLE entries (word TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;`,
    );
    const insert = db.prepare("INSERT INTO entries VALUES (?, ?)");
    let count = 0;
    for (const [word, entries] of definitions) {
      const finished = finishWord(entries);
      if (finished.length === 0) continue;
      insert.run(word, JSON.stringify(finished));
      count++;
    }
    finish({
      source: WIKTIONARY.id,
      version: wiktionary.version,
      sha256: wiktionaryHash,
      licence: WIKTIONARY.licence,
      words: String(count),
    });
    console.log(
      `Done: ${count} headwords with definitions, ${Math.round(fs.statSync(DEFINITIONS).size / 1e6)} MB.`,
    );
  }

  if (thesaurus) {
    const { db, finish } = newDatabase(
      SYNONYMS,
      `-- The synonyms of a headword as JSON, a table per source.
      CREATE TABLE wiktionary (word TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE thesaurus (word TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;`,
    );
    const insertWiktionary = db.prepare("INSERT INTO wiktionary VALUES (?, ?)");
    for (const [word, entries] of synonyms) {
      insertWiktionary.run(word, JSON.stringify(entries));
    }
    const insertThesaurus = db.prepare("INSERT INTO thesaurus VALUES (?, ?)");
    for (const [word, senses] of thesaurus.senses) {
      insertThesaurus.run(word, JSON.stringify(senses));
    }
    finish({
      source: "synonyms",
      version: `${WIKTIONARY.id} ${wiktionary.version}, ${THESAURUS.id} ${thesaurus.version}`,
      "wiktionary.sha256": wiktionaryHash,
      "wiktionary.licence": WIKTIONARY.licence,
      "thesaurus.sha256": thesaurus.sha256,
      "thesaurus.dataSha256": thesaurus.dataSha256,
      "thesaurus.licence": thesaurus.licence,
      words: String(
        new Set([...synonyms.keys(), ...thesaurus.senses.keys()]).size,
      ),
      "wiktionary.words": String(synonyms.size),
      "thesaurus.words": String(thesaurus.senses.size),
    });
    console.log(
      `Done: ${synonyms.size} Wiktionary and ${thesaurus.senses.size} thesaurus headwords with synonyms, ${Math.round(fs.statSync(SYNONYMS).size / 1e6)} MB.`,
    );
  }
}

// wordfreq's Polish list, CC BY-SA 4.0 (D64), pinned to a release like PoliMorf.
const WORDFREQ = {
  id: "wordfreq",
  version: "3.2",
  url: "https://raw.githubusercontent.com/rspeer/wordfreq/v3.2/wordfreq/data/large_pl.msgpack.gz",
  file: path.join(DICT_DIR, "src/wordfreq-3.2-large_pl.msgpack.gz"),
  sha256: "fac63e49c49ea2e39dd8a48152d7e54cec0920abbc59993088063ed5d9b528c2",
  licence: "CC BY-SA 4.0",
};

async function readWordfreq(): Promise<Map<string, number>> {
  if (!fs.existsSync(WORDFREQ.file)) {
    console.log("Fetching wordfreq…");
    const response = await fetch(WORDFREQ.url);
    if (!response.ok) throw new Error(`wordfreq: HTTP ${response.status}`);
    fs.writeFileSync(WORDFREQ.file, Buffer.from(await response.arrayBuffer()));
  }
  const data = fs.readFileSync(WORDFREQ.file);
  if (sha256(data) !== WORDFREQ.sha256) {
    throw new Error("wordfreq: wrong checksum.");
  }
  return wordFrequencies(gunzipSync(data));
}

const LOWER_CASE = /^[a-ząćęłńóśźżqvx]+$/;
const CAPITALISED = /^[A-ZĄĆĘŁŃÓŚŹŻQVX][a-ząćęłńóśźżqvx]+$/;

// The rhyme keys of every form of the form table (task 34, D64). Names count too, unless the
// same word is also written in lower case ("Kot" next to "kot"); their frequency is that of the
// lower-case word, as wordfreq has only those. Lemma ids are those of the form table the rhymes
// were built from, which meta names.
// Spellings without diacritics wordfreq counts often, though PoliMorf has them only as rare
// words: they would show as common rhymes ("sie" for "nie").
const MISSPELLINGS = new Set([
  "sie",
  "cie",
  "sa",
  "tez",
  "juz",
  "moze",
  "wiec",
]);

async function buildRhymes() {
  if (!fs.existsSync(DATABASE)) {
    throw new Error("No form table: run `npm run dict:build forms` first.");
  }
  const frequencies = await readWordfreq();
  const forms = new DatabaseSync(DATABASE, { readOnly: true });
  const formsMeta = Object.fromEntries(
    (
      forms.prepare("SELECT key, value FROM meta").all() as {
        key: string;
        value: string;
      }[]
    ).map(({ key, value }) => [key, value]),
  );
  const tags = new Map(
    (
      forms.prepare("SELECT id, tag FROM tags").all() as {
        id: number;
        tag: string;
      }[]
    ).map(({ id, tag }) => [id, tag]),
  );
  const lowerCaseExists = forms.prepare(
    "SELECT 1 FROM forms WHERE form = ? LIMIT 1",
  );

  const { db, finish } = newDatabase(
    RHYMES,
    `-- Rows go in by reversed phones, so the rows of one key sit on nearby pages.
    CREATE TEMP TABLE staging (
      rev TEXT NOT NULL, form TEXT NOT NULL, phones TEXT NOT NULL, exact TEXT NOT NULL,
      near TEXT NOT NULL, last TEXT, freq INTEGER NOT NULL, lemmas TEXT NOT NULL,
      flags INTEGER NOT NULL
    );
    -- A form with its keys (lib/tools/rhyme-key.ts), Zipf frequency × 100 (0 when unlisted),
    -- comma-separated lemma ids and flags (lib/tools/rhymes-import.ts).
    CREATE TABLE words (
      form TEXT NOT NULL, phones TEXT NOT NULL, exact TEXT NOT NULL, near TEXT NOT NULL,
      last TEXT, freq INTEGER NOT NULL, lemmas TEXT NOT NULL, flags INTEGER NOT NULL
    );`,
  );
  db.exec("PRAGMA cache_size = -1000000");
  const insert = db.prepare(
    "INSERT INTO staging VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  console.log(`Building ${path.relative(ROOT, RHYMES)}…`);
  let form = "";
  let lemmas = new Set<number>();
  let formTags: string[] = [];
  const flush = () => {
    if (!LOWER_CASE.test(form)) {
      if (!CAPITALISED.test(form)) return;
      if (lowerCaseExists.get(form.toLowerCase())) return;
    }
    const keys = rhymeKeys(form, formTags.some(isVerbTag));
    if (!keys) return;
    insert.run(
      [...keys.phones].reverse().join(""),
      form,
      keys.phones,
      keys.exact,
      keys.near,
      keys.last,
      MISSPELLINGS.has(form) ? 0 : (frequencies.get(form.toLowerCase()) ?? 0),
      [...lemmas].join(","),
      formFlags(form.toLowerCase(), formTags),
    );
  };
  // Grouped by form; ORDER BY keeps SQLite off the lemma index.
  for (const row of forms
    .prepare("SELECT form, lemma_id, tag_id FROM forms ORDER BY form")
    .iterate() as Iterable<{
    form: string;
    lemma_id: number;
    tag_id: number;
  }>) {
    if (row.form !== form) {
      if (form) flush();
      form = row.form;
      lemmas = new Set();
      formTags = [];
    }
    lemmas.add(row.lemma_id);
    formTags.push(tags.get(row.tag_id)!);
  }
  if (form) flush();
  forms.close();
  db.exec(`
    INSERT INTO words
      SELECT form, phones, exact, near, last, freq, lemmas, flags FROM staging ORDER BY rev;
    DROP TABLE staging;
    CREATE INDEX words_form ON words (form);
    CREATE INDEX words_exact ON words (exact, freq DESC);
    CREATE INDEX words_near ON words (near, freq DESC);
    CREATE INDEX words_last ON words (last, freq DESC);
  `);
  const { count } = db.prepare("SELECT count(*) AS count FROM words").get() as {
    count: number;
  };
  finish({
    source: "rhymes",
    version: `${SOURCE.id} ${formsMeta.version}, ${WORDFREQ.id} ${WORDFREQ.version}`,
    "forms.builtAt": formsMeta.builtAt,
    "wordfreq.sha256": WORDFREQ.sha256,
    licence: WORDFREQ.licence,
    words: String(count),
  });
  console.log(
    `Done: ${count} forms, ${Math.round(fs.statSync(RHYMES).size / 1e6)} MB.`,
  );
}

const DATABASES = {
  forms: DATABASE,
  definitions: DEFINITIONS,
  synonyms: SYNONYMS,
  rhymes: RHYMES,
};
type DatabaseName = keyof typeof DATABASES;
const isDatabase = (value: string): value is DatabaseName =>
  Object.hasOwn(DATABASES, value);

async function build() {
  const args = process.argv.slice(3);
  const what = args.find((arg) => !arg.startsWith("--"));
  if (what !== undefined && !isDatabase(what)) {
    throw new Error(
      "Usage: npm run dict:build [forms|definitions|synonyms|rhymes] [--refresh]",
    );
  }
  const wanted = (name: DatabaseName) => what === undefined || what === name;
  if (wanted("forms")) await buildForms();
  if (wanted("definitions") || wanted("synonyms")) {
    const refresh = args.includes("--refresh");
    await buildWiktionary(
      {
        definitions: refresh || wanted("definitions"),
        synonyms: refresh || wanted("synonyms"),
      },
      refresh,
    );
  }
  if (wanted("rhymes")) await buildRhymes();
}

function builtAt(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'builtAt'")
    .get() as { value: string };
  db.close();
  return row.value;
}

function secret(): string {
  const match = /^TOOLS_API_SECRET=(.+?)\r?$/m.exec(
    fs.existsSync(TOOLS_ENV) ? fs.readFileSync(TOOLS_ENV, "utf8") : "",
  );
  if (!match) throw new Error("No tools server secret: run `npm run up`.");
  return match[1];
}

const toolsServer = (args: string[]) => [
  "compose",
  "--profile",
  "tools",
  "exec",
  "-T",
  "tools-server",
  ...args,
];

// The local tools server runs the service in Docker inside its container (task 54); on the real
// server (task 28) the same stream goes over SSH.
function dictionaryVolume(): { volume: string; image: string } {
  const ids = execFileSync(
    "docker",
    toolsServer([
      "docker",
      "ps",
      "--quiet",
      "--filter",
      "label=com.docker.compose.service=dictionary",
    ]),
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  if (ids.length !== 1) {
    throw new Error(
      `Expected one running dictionary container, found ${ids.length}: run \`npm run up\`.`,
    );
  }
  const [volume, image] = execFileSync(
    "docker",
    toolsServer([
      "docker",
      "inspect",
      "--format",
      '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}} {{.Config.Image}}',
      ids[0],
    ]),
    { cwd: ROOT, encoding: "utf8" },
  )
    .trim()
    .split(" ");
  if (!volume || !image) throw new Error("No data volume on the dictionary.");
  return { volume, image };
}

// The service reopens a file when it changes, so new data needs no restart. The temporary file
// sits on the same volume, so the rename is atomic; a cut-off stream ends `cat` without an
// error, so the size is checked before the rename. The file is written by a separate container:
// in the service's own (128 MB limit) the written pages count against it and the OOM killer
// restarts the service.
function uploadFile(
  file: string,
  { volume, image }: { volume: string; image: string },
): Promise<void> {
  const name = path.basename(file);
  console.log(`Uploading ${name}…`);
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "docker",
      toolsServer([
        "docker",
        "run",
        "--rm",
        "-i",
        "--volume",
        `${volume}:/data`,
        "--entrypoint",
        "sh",
        image,
        "-c",
        'cat > "/data/$2.tmp" && [ "$(wc -c < "/data/$2.tmp")" -eq "$1" ] && mv -f "/data/$2.tmp" "/data/$2" || { rm -f "/data/$2.tmp"; exit 1; }',
        "sh",
        String(fs.statSync(file).size),
        name,
      ]),
      { cwd: ROOT, stdio: ["pipe", "inherit", "inherit"] },
    );
    const input = fs.createReadStream(file);
    input.on("error", reject);
    child.stdin.on("error", reject);
    input.pipe(child.stdin);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Upload failed (${code}).`)),
    );
  });
}

async function upload() {
  const what = process.argv[3];
  if (what !== undefined && !isDatabase(what)) {
    throw new Error(
      "Usage: npm run dict:upload [forms|definitions|synonyms|rhymes]",
    );
  }
  const built = Object.entries(DATABASES).filter(
    ([key, file]) => (!what || key === what) && fs.existsSync(file),
  );
  if (built.length === 0) {
    throw new Error("No database: run `npm run dict:build` first.");
  }
  const target = dictionaryVolume();
  for (const [, file] of built) await uploadFile(file, target);
  const response = await fetch(`${TOOLS_API_URL}/dict/health`, {
    headers: { "X-Tools-Secret": secret() },
  });
  if (response.status === 503) {
    throw new Error(
      "The service has no form table and answers nothing yet: run `npm run dict:upload forms`.",
    );
  }
  const health = (response.ok ? await response.json() : {}) as Record<
    string,
    { builtAt?: string } | null
  >;
  for (const [key, file] of built) {
    const expected = builtAt(file);
    if (health[key]?.builtAt !== expected) {
      throw new Error(
        `The service does not serve the new ${key} database yet.`,
      );
    }
    console.log(`Done: the service serves ${key} built at ${expected}.`);
  }
}

const commands: Record<string, () => Promise<void>> = { build, upload };
const run = commands[process.argv[2] ?? ""];
if (run) {
  run().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  console.error("Usage: tsx scripts/dictionary.ts build|upload");
  process.exitCode = 1;
}
