import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrate";
import { DEFAULT_LAYOUT } from "@/lib/editor-layout";
import { getUserSettings } from "@/lib/settings/queries";
import * as folders002 from "@/migrations/002-folders";
import * as positions003 from "@/migrations/003-positions";
import * as settings004 from "@/migrations/004-settings";
import { setupTestDb } from "./test-db";

setupTestDb();

const db = () => mongoose.connection.db!;
const users = () => db().collection("users");
const settings = () => db().collection("settings");
const run = () =>
  runMigrations(
    mongoose.connection,
    [folders002, positions003, settings004],
    () => {},
  );

async function insertUser(fields: Record<string, unknown> = {}) {
  const { insertedId } = await users().insertOne({
    email: `${new Types.ObjectId()}@example.com`,
    passwordHash: "x",
    ...fields,
  });
  return insertedId;
}

const legacyFields = ["folderSort", "manualFolderOrder", "settings"];

beforeEach(async () => {
  await db().collection("migrations").deleteMany({});
  for (const { name } of await db().listCollections().toArray()) {
    if (name.includes("_backup_")) await db().dropCollection(name);
  }
});

describe("004-settings", () => {
  it("moves the sort mode from users to the settings collection", async () => {
    const manual = await insertUser({
      folderSort: "manual",
      manualFolderOrder: true,
    });
    const plain = await insertUser({
      folderSort: "updated",
      manualFolderOrder: false,
    });
    const fresh = await insertUser();

    await run();

    expect(await getUserSettings(manual.toString())).toMatchObject({
      folders: { sort: "manual", manualOrder: true },
    });
    expect(await settings().findOne({ userId: plain })).toMatchObject({
      folders: { sort: "updated", manualOrder: false },
      createdAt: expect.any(Date),
    });
    expect(await settings().findOne({ userId: fresh })).toBeNull();
    for (const user of await users().find().toArray()) {
      for (const name of legacyFields) expect(user).not.toHaveProperty(name);
    }
  });

  it("moves the settings of unreleased task 09 builds into groups", async () => {
    const layout = { ...DEFAULT_LAYOUT, split: true };
    const user = await insertUser({
      folderSort: "alpha",
      settings: { editorLayout: layout, mobileView: "notes", theme: "dark" },
    });

    await run();

    expect(await getUserSettings(user.toString())).toEqual({
      editor: { layout, mobileView: "notes" },
      appearance: { theme: "dark" },
      folders: { sort: "alpha", manualOrder: false },
    });
  });

  it("keeps settings chosen after the move on later runs", async () => {
    const user = await insertUser({
      folderSort: "manual",
      manualFolderOrder: true,
    });
    await run();
    await settings().updateOne(
      { userId: user },
      { $set: { "appearance.theme": "dark" } },
    );

    await run();

    expect(await getUserSettings(user.toString())).toMatchObject({
      appearance: { theme: "dark" },
      folders: { sort: "manual", manualOrder: true },
    });
    expect(await settings().countDocuments()).toBe(1);
  });

  it("takes a sort mode the old deployment wrote during the build", async () => {
    const user = await insertUser({ folderSort: "updated" });
    await run();
    await settings().updateOne(
      { userId: user },
      { $set: { "appearance.theme": "light" } },
    );
    await users().updateOne(
      { _id: user },
      { $set: { folderSort: "manual", manualFolderOrder: true } },
    );

    await run();

    expect(await getUserSettings(user.toString())).toMatchObject({
      appearance: { theme: "light" },
      folders: { sort: "manual", manualOrder: true },
    });
    expect(await users().findOne({ _id: user })).not.toHaveProperty(
      "folderSort",
    );
  });
});
