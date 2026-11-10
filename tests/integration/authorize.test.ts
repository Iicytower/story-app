import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrUpdateUser } from "@/lib/accounts";
import {
  authorizeCredentials,
  LOGIN_DELAY_MS,
  LoginRateLimited,
} from "@/lib/auth/authorize";
import { RateLimit } from "@/lib/models/rate-limit";
import {
  accountKey,
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_LIMIT,
  takeAttempt,
} from "@/lib/rate-limit";
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
    const long = PASSWORD.padEnd(256, "xy3Q");
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

describe("login limit per address", () => {
  // On Vercel (D74); X-Forwarded-For is what the client sent and changes on every request.
  function request(ip: string, forwardedFor = ip) {
    return new Request("http://localhost/", {
      headers: {
        "x-vercel-forwarded-for": ip,
        "x-forwarded-for": forwardedFor,
      },
    });
  }

  const wrong = { nickname: "Alice", password: "Wrong-password-12345" };

  beforeEach(async () => {
    vi.stubEnv("VERCEL", "1");
    await createOrUpdateUser("Alice", PASSWORD);
    for (let i = 0; i < LOGIN_LIMIT.max - 1; i++) {
      await takeAttempt(LOGIN_LIMIT, "203.0.113.7");
    }
  });

  afterEach(() => vi.unstubAllEnvs());

  it("refuses further attempts from an address, even with the right password", async () => {
    await expect(
      authorizeCredentials(wrong, request("203.0.113.7")),
    ).resolves.toBeNull();

    await expect(
      authorizeCredentials(
        { nickname: "Alice", password: PASSWORD },
        request("203.0.113.7"),
      ),
    ).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("a changed X-Forwarded-For does not get around it", async () => {
    await authorizeCredentials(wrong, request("203.0.113.7", "198.51.100.1"));
    await expect(
      authorizeCredentials(
        { nickname: "Bob", password: PASSWORD },
        request("203.0.113.7", "198.51.100.2"),
      ),
    ).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("does not count successful sign-ins", async () => {
    const credentials = { nickname: "Alice", password: PASSWORD };
    await authorizeCredentials(credentials, request("203.0.113.7"));

    await expect(
      authorizeCredentials(credentials, request("203.0.113.7")),
    ).resolves.toMatchObject({ name: "Alice" });
  });

  it("leaves other addresses alone", async () => {
    await authorizeCredentials(wrong, request("203.0.113.7"));

    await expect(
      authorizeCredentials(
        { nickname: "Bob", password: "x" },
        request("198.51.100.9"),
      ),
    ).resolves.toBeNull();
  });
});

describe("without a trusted address", () => {
  it("clients do not share one limit", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    await RateLimit.deleteMany({});
    // One failed attempt per nickname: only the per-address limit could stop them.
    await Promise.all(
      Array.from({ length: LOGIN_LIMIT.max + 2 }, (_, i) =>
        authorizeCredentials({ nickname: `user-${i}`, password: "x" }),
      ),
    );
    await expect(
      authorizeCredentials({ nickname: "Alice", password: PASSWORD }),
    ).resolves.toMatchObject({ name: "Alice" });
    expect(await RateLimit.countDocuments({ _id: /^login:/ })).toBe(0);
  });
});

describe("login limit per account", () => {
  const right = { nickname: "Alice", password: PASSWORD };

  beforeEach(async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.max - 1; i++) {
      await takeAttempt(LOGIN_ACCOUNT_LIMIT, accountKey("Alice"));
    }
  });

  afterEach(() => vi.useRealTimers());

  it("stops guessing one account from many addresses, also with the right password", async () => {
    vi.stubEnv("VERCEL", "1");
    const from = (ip: string) =>
      new Request("http://localhost/", {
        headers: { "x-vercel-forwarded-for": ip },
      });
    await expect(
      authorizeCredentials(
        { nickname: "ALICE", password: "Wrong-password-12345" },
        from("198.51.100.1"),
      ),
    ).resolves.toBeNull();
    await expect(
      authorizeCredentials(right, from("198.51.100.2")),
    ).rejects.toBeInstanceOf(LoginRateLimited);
    vi.unstubAllEnvs();
  });

  it("counts a nickname without an account the same way", async () => {
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.max; i++) {
      await takeAttempt(LOGIN_ACCOUNT_LIMIT, accountKey("nobody"));
    }
    await expect(
      authorizeCredentials({ nickname: "Nobody", password: "x" }),
    ).rejects.toBeInstanceOf(LoginRateLimited);
  });

  it("lets the right password in again once the window has passed", async () => {
    await authorizeCredentials({ nickname: "Alice", password: "wrong" });
    await expect(authorizeCredentials(right)).rejects.toBeInstanceOf(
      LoginRateLimited,
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + LOGIN_ACCOUNT_LIMIT.windowMs);
    await expect(authorizeCredentials(right)).resolves.toMatchObject({
      name: "Alice",
    });
  });

  it("does not count successful sign-ins", async () => {
    await authorizeCredentials(right);
    await expect(authorizeCredentials(right)).resolves.toMatchObject({
      name: "Alice",
    });
  });
});
