import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Its own database: migrate.test.ts drops story_app_test_cli_*.
const URI = `mongodb://127.0.0.1:27017/story_app_test_admin_${process.env.VITEST_POOL_ID ?? "0"}`;
const execFileAsync = promisify(execFile);

function admin(...args: string[]) {
  return execFileAsync("npx", ["tsx", "scripts/admin.ts", ...args], {
    env: { PATH: process.env.PATH, NODE_ENV: "test", MONGODB_URI: URI },
  });
}

describe("scripts/admin.ts", () => {
  let connection: mongoose.Connection;
  const users = () => connection.db!.collection("users");
  const roleOf = async (nickname: string) =>
    (await users().findOne({ nickname }))?.role;

  beforeAll(async () => {
    connection = await mongoose.createConnection(URI).asPromise();
  });

  beforeEach(async () => {
    await connection.dropDatabase();
    await users().insertMany([
      { nickname: "Alice", passwordHash: "x", createdAt: new Date() },
      { nickname: "bob", passwordHash: "x", createdAt: new Date() },
    ]);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it("adds, lists and removes admins by nickname in any case", async () => {
    await admin("add", "alice");
    await admin("add", "Bob");
    expect(await roleOf("Alice")).toBe("admin");
    await expect(admin("list")).resolves.toMatchObject({
      stdout: "Alice\nbob\n",
    });

    await admin("remove", "ALICE");
    expect(await roleOf("Alice")).toBeUndefined();
    await expect(admin("list")).resolves.toMatchObject({ stdout: "bob\n" });
  }, 60_000);

  it("rejects a nickname without an account", async () => {
    await expect(admin("add", "Nobody")).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('No account with the nickname "Nobody"'),
    });
    expect(await users().countDocuments({ role: "admin" })).toBe(0);
  }, 30_000);

  it("prints the usage for an unknown command", async () => {
    await expect(admin("promote", "Alice")).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("npm run admin -- list"),
    });
  }, 30_000);
});
