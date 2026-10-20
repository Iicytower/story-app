import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Connection, mongo } from "mongoose";
import { isDuplicateKeyError } from "@/lib/db";

export interface Migration {
  id: string;
  // Copied to `<name>_backup_<id>` before `up` runs.
  collections: string[];
  up(db: mongo.Db): Promise<void>;
  // Runs `up` on every invocation, e.g. to fix data written by an old deployment during the build.
  // The backup is taken only before the first run.
  repeatable?: boolean;
}

interface MigrationRecord {
  _id: string;
  appliedAt?: Date;
  startedAt?: Date;
}

const LOCK_ID = "lock";
// A failed build never releases its lock, so an old one is taken over.
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const BACKUP_INFIX = "_backup_";
const BACKUPS_KEPT = 3;
const FILE_PATTERN = /^\d{3}-[\w-]+\.ts$/;

export type MigrationDecision = { run: true } | { run: false; reason: string };

export function decideMigration(
  env: Record<string, string | undefined>,
): MigrationDecision {
  const { VERCEL_ENV, VERCEL_GIT_COMMIT_REF, MONGODB_URI } = env;
  if (VERCEL_ENV === undefined) return { run: true };

  const target =
    VERCEL_ENV === "production"
      ? "production"
      : VERCEL_ENV === "preview" && VERCEL_GIT_COMMIT_REF === "staging"
        ? "staging"
        : null;
  if (!target) {
    return {
      run: false,
      reason: `Skipping migrations for the ${VERCEL_ENV} deployment of branch ${VERCEL_GIT_COMMIT_REF ?? "(unknown)"}.`,
    };
  }
  if (!MONGODB_URI) {
    throw new Error(`MONGODB_URI is not set for the ${target} build.`);
  }
  return { run: true };
}

export async function loadMigrations(dir: string): Promise<Migration[]> {
  const files = (await readdir(dir))
    .filter((file) => FILE_PATTERN.test(file))
    .sort();
  return Promise.all(
    files.map(async (file) => {
      const migration: Migration = await import(
        pathToFileURL(path.join(dir, file)).href
      );
      if (migration.id !== path.basename(file, ".ts")) {
        throw new Error(
          `${file}: exported id "${migration.id}" does not match the file name.`,
        );
      }
      return migration;
    }),
  );
}

export async function runMigrations(
  connection: Connection,
  migrations: Migration[],
  log: (message: string) => void = console.log,
): Promise<string[]> {
  const db = connection.db!;
  const records = db.collection<MigrationRecord>("migrations");
  const lockedAt = await acquireLock(records, log);

  try {
    const applied = new Set(
      (await records.find({ _id: { $ne: LOCK_ID } }).toArray()).map(
        (record) => record._id,
      ),
    );
    const pending = migrations
      .filter((migration) => migration.repeatable || !applied.has(migration.id))
      .sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const migration of pending) {
      const firstRun = !applied.has(migration.id);
      log(`${firstRun ? "Applying" : "Re-running"} ${migration.id}`);
      if (firstRun) await backup(db, migration);
      try {
        await migration.up(db);
      } catch (error) {
        throw new Error(`Migration ${migration.id} failed.`, { cause: error });
      }
      if (firstRun) {
        await records.insertOne({ _id: migration.id, appliedAt: new Date() });
        await pruneBackups(db);
      }
    }
    if (pending.length === 0) log("No pending migrations.");

    const dropped = await connection.syncIndexes();
    log(`Indexes synced, dropped: ${JSON.stringify(dropped)}`);
    return pending.map((migration) => migration.id);
  } finally {
    await records.deleteOne({ _id: LOCK_ID, startedAt: lockedAt });
  }
}

async function acquireLock(
  records: mongo.Collection<MigrationRecord>,
  log: (message: string) => void,
): Promise<Date> {
  const startedAt = new Date();
  try {
    await records.insertOne({ _id: LOCK_ID, startedAt });
    return startedAt;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const taken = await records.findOneAndUpdate(
    {
      _id: LOCK_ID,
      startedAt: { $lt: new Date(startedAt.getTime() - LOCK_TIMEOUT_MS) },
    },
    { $set: { startedAt } },
  );
  if (!taken) {
    throw new Error(
      'Another migration is in progress. If none is running, remove the lock: db.migrations.deleteOne({ _id: "lock" })',
    );
  }
  log(`Took over a stale lock from ${taken.startedAt?.toISOString()}`);
  return startedAt;
}

async function backup(db: mongo.Db, migration: Migration): Promise<void> {
  for (const name of migration.collections) {
    const target = `${name}${BACKUP_INFIX}${migration.id}`;
    // A retry after a failed `up` must keep the snapshot taken before the first attempt.
    if (await collectionExists(db, target)) continue;
    await db
      .collection(name)
      .aggregate([{ $out: target }])
      .toArray();
  }
}

async function pruneBackups(db: mongo.Db): Promise<void> {
  const names = (
    await db
      .listCollections({ name: { $regex: BACKUP_INFIX } }, { nameOnly: true })
      .toArray()
  ).map((collection) => collection.name);
  const migrationId = (name: string) =>
    name.slice(name.indexOf(BACKUP_INFIX) + BACKUP_INFIX.length);
  const kept = new Set(
    [...new Set(names.map(migrationId))].sort().slice(-BACKUPS_KEPT),
  );
  await Promise.all(
    names
      .filter((name) => !kept.has(migrationId(name)))
      .map((name) => db.dropCollection(name)),
  );
}

async function collectionExists(db: mongo.Db, name: string): Promise<boolean> {
  return (
    (await db.listCollections({ name }, { nameOnly: true }).toArray()).length >
    0
  );
}
