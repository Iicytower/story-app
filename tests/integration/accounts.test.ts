import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { createOrUpdateUser, userExists, verifyPassword } from "@/lib/accounts";
import { runMigrations } from "@/lib/migrate";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

const PASSWORD = "Correct-horse-12345";
const NEW_PASSWORD = "Battery-staple-12345";

describe("createOrUpdateUser", () => {
  it("creates an account without an email", async () => {
    await expect(createOrUpdateUser("Alice", PASSWORD)).resolves.toBe(
      "created",
    );

    const user = await User.findOne({ nickname: "Alice" }).lean();
    expect(user).not.toHaveProperty("email");
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.passwordHash).not.toContain(PASSWORD);
    await expect(verifyPassword(PASSWORD, user!.passwordHash)).resolves.toBe(
      true,
    );
  });

  it("stores the nickname trimmed, in the case it was typed", async () => {
    await createOrUpdateUser("  Alice ", PASSWORD);
    const users = await User.find().lean();
    expect(users.map((u) => u.nickname)).toEqual(["Alice"]);
    await expect(userExists("aLiCe")).resolves.toBe(true);
  });

  it("adds another account on a subsequent run", async () => {
    await createOrUpdateUser("alice", PASSWORD);
    await expect(createOrUpdateUser("bob", PASSWORD)).resolves.toBe("created");
    await expect(User.countDocuments()).resolves.toBe(2);
  });

  it("changes the password of an existing account, whatever the case", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    const before = await User.findOne({ nickname: "Alice" }).lean();

    await expect(createOrUpdateUser("ALICE", NEW_PASSWORD)).resolves.toBe(
      "updated",
    );

    const after = await User.findOne({ nickname: "Alice" }).lean();
    expect(after?._id).toEqual(before?._id);
    expect(after?.createdAt).toEqual(before?.createdAt);
    await expect(
      verifyPassword(NEW_PASSWORD, after!.passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword(PASSWORD, after!.passwordHash)).resolves.toBe(
      false,
    );
    await expect(User.countDocuments()).resolves.toBe(1);
  }, 20000); // Four bcrypt rounds at cost 12 in pure JS.

  it("rejects a weak password", async () => {
    await expect(createOrUpdateUser("alice", "short")).rejects.toThrow(
      /at least 17/,
    );
    await expect(User.countDocuments()).resolves.toBe(0);
  });

  it("rejects an invalid nickname", async () => {
    await expect(createOrUpdateUser("a@b", PASSWORD)).rejects.toThrow(
      /Nickname/,
    );
    await expect(User.countDocuments()).resolves.toBe(0);
  });

  it("reports a missing account as not existing", async () => {
    await expect(userExists("nobody")).resolves.toBe(false);
  });
});

describe("indexes of accounts from before task 36", () => {
  const users = () => mongoose.connection.db!.collection("users");

  it("syncing drops the email index and keeps the data, also with no nickname set yet", async () => {
    await users().dropIndexes();
    await users().createIndex({ email: 1 }, { unique: true });
    await users().insertMany([
      { email: "a@example.com", passwordHash: "x" },
      { email: "b@example.com", passwordHash: "y" },
    ]);

    await runMigrations(mongoose.connection, [], () => {});

    const names = (await users().indexes()).map((index) => index.name);
    expect(names).not.toContain("email_1");
    expect(names).toContain("nickname_1");
    const emails = await users().find().toArray();
    expect(emails.map((user) => user.email).sort()).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("a nickname set by hand logs in and stays unique", async () => {
    await users().insertOne({
      email: "a@example.com",
      passwordHash: "x",
    });
    await users().updateOne({}, { $set: { nickname: "Owner" } });

    await expect(userExists("owner")).resolves.toBe(true);
    await expect(
      users().insertOne({ nickname: "OWNER", passwordHash: "y" }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
