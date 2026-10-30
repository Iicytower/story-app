import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

// Script and restore commands run against the Docker instance only; never .env.prod or the real backup directory.
const SCRIPT = path.join(process.cwd(), "scripts/backup.sh");
const HOST = "mongodb://127.0.0.1:27017";
const WORKER = process.env.VITEST_POOL_ID ?? "0";
const SOURCE_DB = `story_app_test_backup_${WORKER}`;
const RESTORE_DB = `story_app_test_restore_${WORKER}`;
const USER = "backup_user";
const PASSWORD = "s3cret-Pa55word";
const SOURCE_URI = `${HOST}/${SOURCE_DB}?serverSelectionTimeoutMS=3000`;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;

let connection: mongoose.Connection;
let tmp: string;
let backupDir: string;

function run(env: {
  uri?: string;
  envFile?: string;
  input?: string;
  path?: string;
}) {
  let envFile = env.envFile;
  if (env.uri !== undefined) {
    envFile = path.join(tmp, "env.prod");
    fs.writeFileSync(envFile, `MONGODB_URI='${env.uri}'\n`);
  }
  const result = spawnSync("bash", [SCRIPT], {
    env: {
      ...process.env,
      ENV_FILE: envFile ?? path.join(tmp, "missing.env"),
      BACKUP_DIR: backupDir,
      ...(env.path ? { PATH: env.path } : {}),
    },
    input: env.input ?? "",
    encoding: "utf8",
  });
  return { code: result.status, output: result.stdout + result.stderr };
}

function backups() {
  return fs.existsSync(backupDir) ? fs.readdirSync(backupDir).sort() : [];
}

// Same commands as in docs/deploy.md ("Backup bazy").
function restoreArchive(backup: string, db: string) {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "host",
      "-v",
      `${backup}:/backup:ro`,
      "mongo:8",
      "mongorestore",
      "--uri",
      `${HOST}/${db}`,
      "--gzip",
      `--archive=/backup/${SOURCE_DB}.archive.gz`,
      "--nsInclude",
      `${SOURCE_DB}.*`,
      "--nsFrom",
      `${SOURCE_DB}.*`,
      "--nsTo",
      `${db}.*`,
    ],
    { stdio: "pipe" },
  );
}

function restoreJson(backup: string, db: string, collection: string) {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "host",
      "-v",
      `${backup}:/backup:ro`,
      "mongo:8",
      "mongoimport",
      "--uri",
      `${HOST}/${db}`,
      `--collection=${collection}`,
      "--jsonArray",
      `--file=/backup/json/${collection}.json`,
    ],
    { stdio: "pipe" },
  );
}

async function snapshot(db: string, withIndexes = true) {
  const database = connection.useDb(db).db!;
  const names = (await database.listCollections().toArray())
    .map((c) => c.name)
    .sort();
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const collection = database.collection(name);
    result[name] = {
      documents: await collection.find().sort({ _id: 1 }).toArray(),
      ...(withIndexes ? { indexes: await collection.indexes() } : {}),
    };
  }
  return result;
}

beforeAll(async () => {
  connection = await mongoose.createConnection(HOST).asPromise();
});

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "story-app-backup-"));
  backupDir = path.join(tmp, "backups");
  await connection.useDb(SOURCE_DB).dropDatabase();
  await connection.useDb(RESTORE_DB).dropDatabase();
  const source = connection.useDb(SOURCE_DB).db!;
  // Users live in admin.system.users and survive dropDatabase.
  await source.command({ dropAllUsersFromDatabase: 1 });
  const userId = new mongoose.Types.ObjectId();
  await source.collection("users").insertOne({
    _id: userId,
    email: "a@example.com",
    createdAt: new Date("2026-01-02T03:04:05.678Z"),
  });
  await source
    .collection("stories")
    .createIndex(
      { userId: 1, folderId: 1, title: 1 },
      { unique: true, partialFilterExpression: { deletedAt: null } },
    );
  await source.collection("stories").insertMany([
    { userId, title: "One", content: "Zażółć\n— dialog", deletedAt: null },
    {
      userId,
      title: "Two",
      content: "",
      tags: ["a", { b: 1 }],
      deletedAt: new Date(),
    },
  ]);
  await source
    .collection("settings")
    .insertOne({ userId, editor: { layout: [1.5, 2] } });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

afterAll(async () => {
  await connection
    .useDb(SOURCE_DB)
    .db!.command({ dropAllUsersFromDatabase: 1 });
  await connection.useDb(SOURCE_DB).dropDatabase();
  await connection.useDb(RESTORE_DB).dropDatabase();
  await connection.close();
});

describe("scripts/backup.sh", { timeout: 60_000 }, () => {
  it("dumps every collection to an archive and JSON files that restore identically", async () => {
    const { code, output } = run({ uri: SOURCE_URI });
    expect(code, output).toBe(0);

    const [name] = backups();
    expect(name).toMatch(TIMESTAMP);
    const backup = path.join(backupDir, name);
    expect(fs.readdirSync(backup).sort()).toEqual([
      "json",
      `${SOURCE_DB}.archive.gz`,
    ]);
    expect(fs.readdirSync(path.join(backup, "json")).sort()).toEqual([
      "settings.json",
      "stories.json",
      "users.json",
    ]);
    expect(fs.statSync(path.join(backup, "json", "users.json")).uid).toBe(
      process.getuid!(),
    );
    expect(
      JSON.parse(
        fs.readFileSync(path.join(backup, "json", "users.json"), "utf8"),
      ),
    ).toEqual([
      {
        _id: { $oid: expect.any(String) },
        email: "a@example.com",
        createdAt: { $date: "2026-01-02T03:04:05.678Z" },
      },
    ]);
    expect(fs.statSync(path.join(backup, `${SOURCE_DB}.archive.gz`)).uid).toBe(
      process.getuid!(),
    );

    const expected = await snapshot(SOURCE_DB);
    expect(Object.keys(expected)).toEqual(["settings", "stories", "users"]);

    restoreArchive(backup, RESTORE_DB);
    expect(await snapshot(RESTORE_DB)).toEqual(expected);

    await connection.useDb(RESTORE_DB).dropDatabase();
    for (const collection of Object.keys(expected)) {
      restoreJson(backup, RESTORE_DB, collection);
    }
    expect(await snapshot(RESTORE_DB, false)).toEqual(
      await snapshot(SOURCE_DB, false),
    );
  });

  it("creates a new timestamped directory on every run", () => {
    expect(run({ uri: SOURCE_URI }).code).toBe(0);
    expect(run({ uri: SOURCE_URI }).code).toBe(0);

    const names = backups();
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    for (const name of names) {
      expect(name).toMatch(TIMESTAMP);
      expect(
        fs.existsSync(path.join(backupDir, name, `${SOURCE_DB}.archive.gz`)),
      ).toBe(true);
    }
  });

  it("keeps the 5 newest backups and leaves other directories alone", () => {
    const old = [
      "2020-01-01T00-00-00Z",
      "2020-01-02T00-00-00Z",
      "2020-01-03T00-00-00Z",
      "2020-01-04T00-00-00Z",
      "2020-01-05T00-00-00Z",
      "2020-01-06T00-00-00Z",
    ];
    for (const name of [...old, "keep-me"]) {
      fs.mkdirSync(path.join(backupDir, name), { recursive: true });
    }

    expect(run({ uri: SOURCE_URI }).code).toBe(0);

    const names = backups();
    expect(names).toHaveLength(6);
    expect(names).toContain("keep-me");
    expect(names.slice(0, 4)).toEqual(old.slice(2));
    expect(names[4]).toMatch(TIMESTAMP);
    expect(names[4] > old[5]).toBe(true);
  });

  it("asks for the URI when .env.prod is missing or has no MONGODB_URI", () => {
    const missing = run({ input: `${SOURCE_URI}\n` });
    expect(missing.code, missing.output).toBe(0);
    expect(missing.output).toContain("MONGODB_URI not found");

    const envFile = path.join(tmp, "other.env");
    fs.writeFileSync(envFile, "AUTH_SECRET=x\n");
    const withoutUri = run({ envFile, input: `${SOURCE_URI}\n` });
    expect(withoutUri.code, withoutUri.output).toBe(0);

    expect(backups()).toHaveLength(2);
  });

  it("does not print the password from the URI", async () => {
    await connection.useDb(SOURCE_DB).db!.command({
      createUser: USER,
      pwd: PASSWORD,
      roles: [{ role: "read", db: SOURCE_DB }],
    });
    const credentials = `mongodb://${USER}:${PASSWORD}@127.0.0.1:27017/${SOURCE_DB}?authSource=${SOURCE_DB}&serverSelectionTimeoutMS=3000`;

    const ok = run({ uri: credentials });
    expect(ok.code, ok.output).toBe(0);
    expect(ok.output).not.toContain(PASSWORD);

    const prompted = run({ input: `${credentials}\n` });
    expect(prompted.code, prompted.output).toBe(0);
    expect(prompted.output).not.toContain(PASSWORD);

    const wrong = run({
      uri: credentials.replace(PASSWORD, `${PASSWORD}-wrong`),
    });
    expect(wrong.code).not.toBe(0);
    expect(wrong.output).not.toContain(PASSWORD);
    expect(backups()).toHaveLength(2);
  });

  it("fails without leaving a backup when no URI is given", () => {
    const { code, output } = run({ input: "" });
    expect(code).not.toBe(0);
    expect(output).toContain("Error: no MongoDB URI given.");
    expect(backups()).toEqual([]);
  });

  it("fails when the URI has no database name", () => {
    const { code, output } = run({
      uri: `${HOST}/?serverSelectionTimeoutMS=3000`,
    });
    expect(code).not.toBe(0);
    expect(output).toContain("must include the database name");
    expect(backups()).toEqual([]);
  });

  it("fails without leaving a backup when the database is unreachable", () => {
    const { code, output } = run({
      uri: `mongodb://127.0.0.1:1/${SOURCE_DB}?serverSelectionTimeoutMS=1000`,
    });
    expect(code).not.toBe(0);
    expect(output).toContain("Error: mongodump failed, backup removed.");
    expect(backups()).toEqual([]);
  });

  it("fails when Docker is missing or not running", () => {
    const bin = path.join(tmp, "bin");
    fs.mkdirSync(bin);
    for (const tool of ["bash", "dirname", "grep", "id", "tail"]) {
      fs.symlinkSync(
        execFileSync("which", [tool], { encoding: "utf8" }).trim(),
        path.join(bin, tool),
      );
    }
    const missing = run({ uri: SOURCE_URI, path: bin });
    expect(missing.code).not.toBe(0);
    expect(missing.output).toContain("Error: docker not found.");

    fs.writeFileSync(
      path.join(bin, "docker"),
      "#!/bin/sh\necho 'Cannot connect to the Docker daemon' >&2\nexit 1\n",
      { mode: 0o755 },
    );
    const stopped = run({ uri: SOURCE_URI, path: bin });
    expect(stopped.code).not.toBe(0);
    expect(stopped.output).toContain("Error: Docker is not running.");

    expect(backups()).toEqual([]);
  });
});
