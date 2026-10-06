import { describe, expect, it } from "vitest";
import { createOrUpdateUser } from "@/lib/accounts";
import { authorizeCredentials, LOGIN_DELAY_MS } from "@/lib/auth/authorize";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

async function timed<T>(promise: Promise<T>) {
  const start = performance.now();
  const result = await promise;
  return { result, elapsed: performance.now() - start };
}

describe("authorizeCredentials", () => {
  it("returns the user with id for valid credentials", async () => {
    await createOrUpdateUser("alice@example.com", "secret-1");
    const user = await User.findOne({ email: "alice@example.com" }).lean();

    const { result, elapsed } = await timed(
      authorizeCredentials({
        email: "alice@example.com",
        password: "secret-1",
      }),
    );

    expect(result).toEqual({
      id: user!._id.toString(),
      email: "alice@example.com",
    });
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("accepts the email in a different case", async () => {
    await createOrUpdateUser("alice@example.com", "secret-1");
    const result = await authorizeCredentials({
      email: " ALICE@Example.com ",
      password: "secret-1",
    });
    expect(result?.email).toBe("alice@example.com");
  });

  it("rejects a wrong password after the delay", async () => {
    await createOrUpdateUser("alice@example.com", "secret-1");
    const { result, elapsed } = await timed(
      authorizeCredentials({ email: "alice@example.com", password: "wrong" }),
    );
    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("rejects an unknown email after the delay", async () => {
    const { result, elapsed } = await timed(
      authorizeCredentials({ email: "nobody@example.com", password: "x" }),
    );
    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(LOGIN_DELAY_MS - 5);
  });

  it("rejects missing credentials", async () => {
    await expect(authorizeCredentials({})).resolves.toBeNull();
  });
});
