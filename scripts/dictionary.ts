// Dictionary databases: `npm run dict:build [forms|definitions]` builds the form table from
// PoliMorf into .tools/dict/forms.sqlite (task 25, D61) and the definitions from the Polish
// Wiktionary into .tools/dict/definitions.sqlite (task 32, D62); without an argument both.
// `npm run dict:upload [forms|definitions]` sends the built files (without an argument all) to the dictionary service on the local tools
// server. Source data and the built files stay out of the repo (licences: D61, D62).
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { DatabaseSync } from "node:sqlite";
import { createGunzip } from "node:zlib";
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

// Kaikki serves only the latest dump (updated weekly), so a downloaded file is kept under the
// date of its Last-Modified header and builds use the newest kept file; `--refresh` fetches the
// current one. Wiktionary's text is CC BY-SA 4.0 (D62).
const WIKTIONARY = {
  id: "wiktionary",
  url: "https://kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz",
  licence: "CC BY-SA 4.0",
};
const SRC_DIR = path.join(DICT_DIR, "src");
const WIKTIONARY_FILE = /^plwiktionary-(\d{8})\.jsonl\.gz$/;

async function wiktionaryDump(refresh: boolean): Promise<string> {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  const kept = fs
    .readdirSync(SRC_DIR)
    .filter((name) => WIKTIONARY_FILE.test(name))
    .sort();
  if (kept.length > 0 && !refresh) return path.join(SRC_DIR, kept.at(-1)!);
  console.log("Fetching the Polish Wiktionary dump…");
  const response = await fetch(WIKTIONARY.url);
  const modified = response.headers.get("last-modified");
  if (!response.ok || !response.body || !modified) {
    throw new Error(`Wiktionary: HTTP ${response.status}`);
  }
  const date = new Date(modified)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const file = path.join(SRC_DIR, `plwiktionary-${date}.jsonl.gz`);
  if (fs.existsSync(file)) {
    await response.body.cancel();
    return file;
  }
  const temporary = `${file}.tmp`;
  await pipeline(
    // DOM and Node typings of the same stream differ.
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    fs.createWriteStream(temporary),
  );
  fs.renameSync(temporary, file);
  return file;
}

async function buildDefinitions(refresh: boolean) {
  const source = await wiktionaryDump(refresh);
  const version = WIKTIONARY_FILE.exec(path.basename(source))![1].replace(
    /(\d{4})(\d{2})(\d{2})/,
    "$1-$2-$3",
  );
  console.log(`Reading ${path.relative(ROOT, source)}…`);
  const hash = createHash("sha256");
  const input = fs.createReadStream(source);
  input.on("data", (chunk) => hash.update(chunk));
  const lines = readline.createInterface({
    input: input.pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  // Entries of one headword can be far apart in the dump; Map keeps the dump's order.
  const words = new Map<string, Entry[]>();
  for await (const line of lines) {
    // Cheap check first: most of the million lines are other languages.
    if (!line.includes('"lang_code": "pl"')) continue;
    const parsed = parseEntry(line);
    if (!parsed) continue;
    const entries = words.get(parsed.word);
    if (entries) entries.push(parsed.entry);
    else words.set(parsed.word, [parsed.entry]);
  }

  const temporary = `${DEFINITIONS}.tmp`;
  fs.rmSync(temporary, { force: true });
  const db = new DatabaseSync(temporary);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    -- All entries of a headword as JSON, in the dump's order.
    CREATE TABLE entries (word TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;
  `);
  const insert = db.prepare("INSERT INTO entries VALUES (?, ?)");
  let count = 0;
  db.exec("BEGIN");
  for (const [word, entries] of words) {
    const finished = finishWord(entries);
    if (finished.length === 0) continue;
    insert.run(word, JSON.stringify(finished));
    count++;
  }
  const insertMeta = db.prepare("INSERT INTO meta VALUES (?, ?)");
  for (const [key, value] of Object.entries({
    source: WIKTIONARY.id,
    version,
    sha256: hash.digest("hex"),
    licence: WIKTIONARY.licence,
    builtAt: new Date().toISOString(),
    words: String(count),
  })) {
    insertMeta.run(key, value);
  }
  db.exec("COMMIT");
  db.exec("VACUUM");
  db.close();
  fs.renameSync(temporary, DEFINITIONS);
  console.log(
    `Done: ${count} headwords, ${Math.round(fs.statSync(DEFINITIONS).size / 1e6)} MB.`,
  );
}

async function build() {
  const args = process.argv.slice(3);
  const what = args.find((arg) => !arg.startsWith("--"));
  if (what && what !== "forms" && what !== "definitions") {
    throw new Error(
      "Usage: npm run dict:build [forms|definitions] [--refresh]",
    );
  }
  if (what !== "definitions") await buildForms();
  if (what !== "forms") await buildDefinitions(args.includes("--refresh"));
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
  if (what && what !== "forms" && what !== "definitions") {
    throw new Error("Usage: npm run dict:upload [forms|definitions]");
  }
  const files = { forms: DATABASE, definitions: DEFINITIONS };
  const built = Object.entries(files).filter(
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
