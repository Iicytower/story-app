import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import mongoose, { Types, type mongo } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMigrations, runMigrations, type Migration } from "@/lib/migrate";
import { Story } from "@/lib/models/story";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

const silent = () => {};

function db(): mongo.Db {
  return mongoose.connection.db!;
}

function migration(
  id: string,
  collections: string[] = [],
  up: Migration["up"] = async () => {},
): Migration {
  return { id, collections, up: vi.fn(up) };
}

function run(migrations: Migration[]) {
  return runMigrations(mongoose.connection, migrations, silent);
}

async function collectionNames(): Promise<string[]> {
  return (await db().listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .sort();
}

async function backupNames(): Promise<string[]> {
  return (await collectionNames()).filter((name) => name.includes("_backup_"));
}

async function documents(name: string) {
  return db().collection(name).find().sort({ _id: 1 }).toArray();
}

async function indexNames(name: string): Promise<string[]> {
  return (await db().collection(name).indexes()).map((index) => index.name!);
}

async function seedStories() {
  const userId = new Types.ObjectId();
  await User.create({ email: "alice@example.com", passwordHash: "hash" });
  await Story.create([
    { userId, folderId: userId, title: "One", content: "first" },
    { userId, folderId: userId, title: "Two", content: "second" },
  ]);
}

beforeEach(async () => {
  // setupTestDb clears only model collections.
  await db().collection("migrations").deleteMany({});
  await Promise.all(
    (await backupNames()).map((name) => db().dropCollection(name)),
  );
});

describe("runMigrations", () => {
  it("applies all migrations in id order and records them", async () => {
    const order: string[] = [];
    const migrations = ["002-b", "001-a", "003-c"].map((id) =>
      migration(id, [], async () => {
        order.push(id);
      }),
    );

    await expect(run(migrations)).resolves.toEqual(["001-a", "002-b", "003-c"]);

    expect(order).toEqual(["001-a", "002-b", "003-c"]);
    const records = await documents("migrations");
    expect(records.map((record) => record._id)).toEqual([
      "001-a",
      "002-b",
      "003-c",
    ]);
    for (const record of records) {
      expect(record.appliedAt).toBeInstanceOf(Date);
    }
  });

  it("runs nothing and changes no data on a second run", async () => {
    await seedStories();
    const migrations = [
      migration("001-a", ["stories"], async (database) => {
        await database
          .collection("stories")
          .updateMany({}, { $set: { notes: "migrated" } });
      }),
    ];
    await run(migrations);
    const stories = await documents("stories");
    const records = await documents("migrations");
    const collections = await collectionNames();

    await expect(run(migrations)).resolves.toEqual([]);

    expect(migrations[0].up).toHaveBeenCalledTimes(1);
    expect(await documents("stories")).toEqual(stories);
    expect(await documents("migrations")).toEqual(records);
    expect(await collectionNames()).toEqual(collections);
  });

  it("re-runs a repeatable migration without a new backup", async () => {
    await seedStories();
    const repeatable = {
      ...migration("001-a", ["stories"], async (database) => {
        await database.collection("stories").deleteOne({});
      }),
      repeatable: true,
    };
    await run([repeatable]);
    const backup = await documents("stories_backup_001-a");
    const records = await documents("migrations");

    await expect(run([repeatable])).resolves.toEqual(["001-a"]);

    expect(repeatable.up).toHaveBeenCalledTimes(2);
    expect(await Story.countDocuments()).toBe(0);
    expect(await documents("stories_backup_001-a")).toEqual(backup);
    expect(await documents("migrations")).toEqual(records);
  });

  it("backs up the listed collections before up runs", async () => {
    await seedStories();
    const stories = await documents("stories");
    const users = await documents("users");
    let backupsDuringUp: unknown[] = [];

    await run([
      migration("001-a", ["stories", "users", "missing"], async (database) => {
        backupsDuringUp = await Promise.all([
          documents("stories_backup_001-a"),
          documents("users_backup_001-a"),
        ]);
        await database.collection("stories").deleteMany({});
      }),
    ]);

    expect(backupsDuringUp).toEqual([stories, users]);
    expect(await documents("stories_backup_001-a")).toEqual(stories);
    expect(await documents("users_backup_001-a")).toEqual(users);
    // $out creates an empty backup for a collection that does not exist.
    expect(await documents("missing_backup_001-a")).toEqual([]);
  });

  it("keeps backups of the 3 most recent migrations only", async () => {
    await seedStories();
    await run(
      ["001-a", "002-b", "003-c"].map((id) => migration(id, ["stories"])),
    );
    expect(await backupNames()).toEqual([
      "stories_backup_001-a",
      "stories_backup_002-b",
      "stories_backup_003-c",
    ]);

    await run([migration("004-d", ["stories", "users"])]);

    expect(await backupNames()).toEqual([
      "stories_backup_002-b",
      "stories_backup_003-c",
      "stories_backup_004-d",
      "users_backup_004-d",
    ]);
  });

  it("fails without changes while another migration holds the lock", async () => {
    await seedStories();
    const startedAt = new Date(Date.now() - 60_000);
    await db()
      .collection<{ _id: string; startedAt: Date }>("migrations")
      .insertOne({ _id: "lock", startedAt });
    await db().collection("stories").createIndex({ content: 1 });
    const stories = await documents("stories");
    const migrations = [migration("001-a", ["stories"])];

    await expect(run(migrations)).rejects.toThrow(
      "Another migration is in progress",
    );

    expect(migrations[0].up).not.toHaveBeenCalled();
    expect(await documents("migrations")).toEqual([{ _id: "lock", startedAt }]);
    expect(await documents("stories")).toEqual(stories);
    expect(await backupNames()).toEqual([]);
    expect(await indexNames("stories")).toContain("content_1");
  });

  it("takes over a lock older than 15 minutes", async () => {
    await db()
      .collection<{ _id: string; startedAt: Date }>("migrations")
      .insertOne({
        _id: "lock",
        startedAt: new Date(Date.now() - 16 * 60_000),
      });

    await expect(run([migration("001-a")])).resolves.toEqual(["001-a"]);

    expect((await documents("migrations")).map((record) => record._id)).toEqual(
      ["001-a"],
    );
  });

  it("does not record a failed migration and releases the lock", async () => {
    await seedStories();
    const stories = await documents("stories");
    const failing = migration("001-a", ["stories"], async (database) => {
      await database.collection("stories").deleteOne({ title: "One" });
      throw new Error("boom");
    });

    await expect(run([failing])).rejects.toThrow("Migration 001-a failed.");
    expect(await documents("migrations")).toEqual([]);

    // The retry keeps the backup taken before the first, partially applied attempt.
    await expect(run([migration("001-a", ["stories"])])).resolves.toEqual([
      "001-a",
    ]);
    expect(await documents("stories_backup_001-a")).toEqual(stories);
  });

  it("syncs indexes even when no migration is pending", async () => {
    await db().collection("stories").createIndex({ content: 1 });
    await db().collection("stories").dropIndex("userId_1_updatedAt_-1");

    await expect(run([])).resolves.toEqual([]);

    const names = await indexNames("stories");
    expect(names).not.toContain("content_1");
    expect(names).toContain("userId_1_updatedAt_-1");
  });
});

describe("loadMigrations", () => {
  it("loads migrations/ with ids matching the file names", async () => {
    const migrations = await loadMigrations(
      path.join(process.cwd(), "migrations"),
    );
    expect(migrations.map((m) => m.id)).toContain("001-baseline");
    for (const m of migrations) {
      expect(typeof m.up).toBe("function");
      expect(Array.isArray(m.collections)).toBe(true);
    }
  });
});

describe("scripts/migrate.ts", () => {
  const execFileAsync = promisify(execFile);
  const cli = (env: Record<string, string>) =>
    execFileAsync("npx", ["tsx", "scripts/migrate.ts"], {
      env: { PATH: process.env.PATH, NODE_ENV: "test", ...env },
    });

  it("applies all migrations on an empty database", async () => {
    const uri = `mongodb://127.0.0.1:27017/story_app_test_cli_${process.env.VITEST_POOL_ID ?? "0"}`;
    const connection = await mongoose.createConnection(uri).asPromise();
    try {
      await connection.dropDatabase();
      await cli({ MONGODB_URI: uri });
      const records = await connection
        .db!.collection("migrations")
        .find()
        .toArray();
      expect(records.map((record) => record._id)).toContain("001-baseline");
      // Fails if lib/models/index.ts misses a model: syncIndexes() covers only registered ones.
      const folderIndexes = await connection
        .db!.collection("folders")
        .indexes();
      expect(folderIndexes.map((index) => index.key)).toContainEqual({
        userId: 1,
        name: 1,
      });
      const storyIndexes = await connection.db!.collection("stories").indexes();
      expect(storyIndexes.map((index) => index.key)).toContainEqual({
        userId: 1,
        folderId: 1,
        title: 1,
      });
    } finally {
      await connection.dropDatabase();
      await connection.close();
    }
  }, 30_000);

  it("exits with a non-zero code on error", async () => {
    await expect(cli({ VERCEL_ENV: "production" })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("MONGODB_URI is not set"),
    });
  }, 30_000);
});
