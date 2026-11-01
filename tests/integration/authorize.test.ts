import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createOrUpdateUser } from "@/lib/accounts";
import { authorizeCredentials, LOGIN_DELAY_MS } from "@/lib/auth/authorize";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

const PASSWORD = "Correct-horse-12345";

async function timed<T>(promise: Promise<T>) {
  const start = performance.now();
  const result = await promise;
  return { result, elapsed: performance.now() - start };
}

describe("authorizeCredentials", () => {
  it("returns the user with id for valid credentials", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    const user = await User.findOne({ nickname: "Alice" }).lean();

    const { result, elapsed } = await timed(
      authorizeCredentials({ nickname: "Alice", password: PASSWORD }),
    );

    expect(result).toEqual({ id: user!._id.toString(), name: "Alice" });
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("accepts the nickname in a different case", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    const result = await authorizeCredentials({
      nickname: " aLICE ",
      password: PASSWORD,
    });
    expect(result?.name).toBe("Alice");
  });

  it("rejects a wrong password after the delay", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    const { result, elapsed } = await timed(
      authorizeCredentials({ nickname: "Alice", password: "wrong" }),
    );
    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("rejects an unknown nickname after the delay", async () => {
    const { result, elapsed } = await timed(
      authorizeCredentials({ nickname: "nobody", password: "x" }),
    );
    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("rejects missing credentials", async () => {
    await expect(authorizeCredentials({})).resolves.toBeNull();
  });

  it("does not log in by email", async () => {
    await User.collection.insertOne({
      email: "alice@example.com",
      nickname: "alice",
      passwordHash: await bcrypt.hash("old-password", 4),
    });
    await expect(
      authorizeCredentials({
        nickname: "alice@example.com",
        password: "old-password",
      }),
    ).resolves.toBeNull();
  });

  it("keeps a password hashed before task 36 valid", async () => {
    await User.collection.insertOne({
      email: "alice@example.com",
      nickname: "alice",
      passwordHash: await bcrypt.hash("old-password", 4),
    });
    const result = await authorizeCredentials({
      nickname: "alice",
      password: "old-password",
    });
    expect(result?.name).toBe("alice");
  });

  it("tells apart passwords differing only past 72 bytes", async () => {
    const long = PASSWORD.padEnd(256, "x");
    await createOrUpdateUser("alice", long);
    await expect(
      authorizeCredentials({ nickname: "alice", password: long }),
    ).resolves.not.toBeNull();
    await expect(
      authorizeCredentials({
        nickname: "alice",
        password: `${long.slice(0, -1)}y`,
      }),
    ).resolves.toBeNull();
  });
});
