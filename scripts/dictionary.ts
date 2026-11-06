// Dictionary database (task 25, D61): `npm run dict:build` builds the form table from PoliMorf into
// .tools/dict/forms.sqlite, `npm run dict:upload` sends the file to the dictionary service on the
// local tools server. Source data and the built file stay out of the repo (licence: D61).
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { createGunzip } from "node:zlib";

const ROOT = process.cwd();
const DICT_DIR = path.join(ROOT, ".tools/dict");
const SOURCE_FILE = path.join(DICT_DIR, "src/polimorf-20261018.tab.gz");
const DATABASE = path.join(DICT_DIR, "forms.sqlite");
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

async function build() {
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

function builtAt(): string {
  const db = new DatabaseSync(DATABASE, { readOnly: true });
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

// The service reopens the file when it changes, so the new data needs no restart. The temporary
// file sits on the same volume, so the rename is atomic; a cut-off stream ends `cat` without an
// error, so the size is checked before the rename. The file is written by a separate container:
// in the service's own (128 MB limit) the written pages count against it and the OOM killer
// restarts the service.
async function upload() {
  if (!fs.existsSync(DATABASE)) {
    throw new Error("No database: run `npm run dict:build` first.");
  }
  const expected = builtAt();
  const size = fs.statSync(DATABASE).size;
  const { volume, image } = dictionaryVolume();
  console.log("Uploading the dictionary database…");
  await new Promise<void>((resolve, reject) => {
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
        'cat > /data/forms.sqlite.tmp && [ "$(wc -c < /data/forms.sqlite.tmp)" -eq "$1" ] && mv -f /data/forms.sqlite.tmp /data/forms.sqlite || { rm -f /data/forms.sqlite.tmp; exit 1; }',
        "sh",
        String(size),
      ]),
      { cwd: ROOT, stdio: ["pipe", "inherit", "inherit"] },
    );
    const input = fs.createReadStream(DATABASE);
    input.on("error", reject);
    child.stdin.on("error", reject);
    input.pipe(child.stdin);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Upload failed (${code}).`)),
    );
  });
  const response = await fetch(`${TOOLS_API_URL}/dict/health`, {
    headers: { "X-Tools-Secret": secret() },
  });
  const health = response.ok
    ? ((await response.json()) as { builtAt?: string })
    : {};
  if (health.builtAt !== expected) {
    throw new Error(`The service does not serve the new database yet.`);
  }
  console.log(`Done: the service serves the database built at ${expected}.`);
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
