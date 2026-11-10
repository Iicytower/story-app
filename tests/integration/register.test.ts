import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "@/app/[locale]/auth/register-actions";
import { signIn } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { createOrUpdateUser, verifyPassword } from "@/lib/accounts";
import { getUserSettings } from "@/lib/settings/queries";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { User } from "@/lib/models/user";
import { Folder } from "@/lib/models/folder";
import { Story } from "@/lib/models/story";
import { REGISTRATION_LIMIT } from "@/lib/rate-limit";
import { setupTestDb } from "./test-db";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));

// bcrypt takes seconds when every test file runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

setupTestDb();

const PASSWORD = "Correct-horse-12345";

// On Vercel (D74): the platform's header is the address, X-Forwarded-For is what the client sent.
function fromAddress(ip: string, forwardedFor = ip) {
  vi.mocked(headers).mockResolvedValue(
    new Headers({
      "x-vercel-forwarded-for": ip,
      "x-forwarded-for": forwardedFor,
    }) as never,
  );
}

beforeEach(() => {
  vi.mocked(signIn).mockReset();
  vi.mocked(redirect).mockReset();
  vi.stubEnv("VERCEL", "1");
  fromAddress("203.0.113.7");
});

describe("register", () => {
  it("creates the account and signs in", async () => {
    await expect(register(" Alice ", PASSWORD, PASSWORD)).resolves.toEqual({
      ok: true,
    });

    const user = await User.findOne({ nickname: "Alice" }).lean();
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      nickname: "Alice",
      password: PASSWORD,
      redirectTo: "/en",
    });
  });

  it("stores only a hash and never returns or logs the password", async () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");

    const result = await register("Alice", PASSWORD, PASSWORD);

    const user = await User.findOne({ nickname: "Alice" }).lean();
    expect(JSON.stringify(user)).not.toContain(PASSWORD);
    await expect(verifyPassword(PASSWORD, user!.passwordHash)).resolves.toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(JSON.stringify([log.mock.calls, error.mock.calls])).not.toContain(
      PASSWORD,
    );
  });

  it("gives a new account no stories and default settings", async () => {
    await register("Alice", PASSWORD, PASSWORD);
    const user = await User.findOne({ nickname: "Alice" }).lean();

    await expect(Story.countDocuments()).resolves.toBe(0);
    await expect(Folder.countDocuments()).resolves.toBe(0);
    await expect(getUserSettings(user!._id.toString())).resolves.toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it.each([
    ["a short nickname", "ab", PASSWORD, /Nickname/],
    ["a nickname with spaces", "al ice", PASSWORD, /Nickname/],
    ["a short password", "Alice", "Short-1!", /at least 17/],
    ["no lowercase", "Alice", "CORRECT-HORSE-12345", /lowercase/],
    ["no uppercase", "Alice", "correct-horse-12345", /uppercase/],
    ["no digit", "Alice", "Correct-horse-abcde", /digit/],
    ["no special character", "Alice", "CorrectHorse1234567", /special/],
    ["too long", "Alice", PASSWORD.padEnd(257, "x"), /at most 256/],
  ])("rejects %s", async (_, nickname, password, message) => {
    await expect(register(nickname, password, password)).resolves.toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: expect.stringMatching(message),
    });
    await expect(User.countDocuments()).resolves.toBe(0);
  });

  it.each<[unknown, unknown, unknown]>([
    [null, PASSWORD, PASSWORD],
    ["Alice", {}, PASSWORD],
    ["Alice", PASSWORD, 1],
  ])("rejects input of a wrong type: %j", async (a, b, c) => {
    await expect(register(a, b, c)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    await expect(User.countDocuments()).resolves.toBe(0);
  });

  it("rejects different passwords on the server too", async () => {
    await expect(
      register("Alice", PASSWORD, `${PASSWORD}x`),
    ).resolves.toMatchObject({
      ok: false,
      message: "The passwords do not match.",
    });
    await expect(User.countDocuments()).resolves.toBe(0);
  });

  it("rejects a taken nickname in any case and keeps the old password", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    const before = await User.findOne().lean();

    await expect(
      register("aLICE", "Battery-staple-12345", "Battery-staple-12345"),
    ).resolves.toEqual({
      ok: false,
      error: "DUPLICATE_NAME",
      message: "This nickname is already taken.",
    });

    expect((await User.findOne().lean())!.passwordHash).toBe(
      before!.passwordHash,
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("creates one account from two simultaneous registrations", async () => {
    const results = await Promise.all([
      register("Alice", PASSWORD, PASSWORD),
      register("ALICE", PASSWORD, PASSWORD),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results).toContainEqual(
      expect.objectContaining({ error: "DUPLICATE_NAME" }),
    );
    await expect(User.countDocuments()).resolves.toBe(1);
  });

  it("refuses accounts over the limit without creating them", async () => {
    for (let i = 0; i < REGISTRATION_LIMIT.max; i++) {
      await expect(register(`user-${i}`, PASSWORD, PASSWORD)).resolves.toEqual({
        ok: true,
      });
    }

    await expect(register("one-more", PASSWORD, PASSWORD)).resolves.toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many sign-up attempts. Try again later.",
    });
    await expect(User.countDocuments()).resolves.toBe(REGISTRATION_LIMIT.max);

    fromAddress("198.51.100.9");
    await expect(register("one-more", PASSWORD, PASSWORD)).resolves.toEqual({
      ok: true,
    });
  });

  it("does not count registrations rejected by validation", async () => {
    for (let i = 0; i < REGISTRATION_LIMIT.max + 1; i++) {
      await register("Bob", "weak", "weak");
    }

    await expect(register("Bob", PASSWORD, PASSWORD)).resolves.toEqual({
      ok: true,
    });
  });

  // I1: the limit comes before the nickname check, so probing nicknames is limited too.
  it("counts a taken nickname against the limit", async () => {
    await createOrUpdateUser("Alice", PASSWORD);
    for (let i = 0; i < REGISTRATION_LIMIT.max; i++) {
      await expect(
        register("Alice", PASSWORD, PASSWORD),
      ).resolves.toMatchObject({ error: "DUPLICATE_NAME" });
    }
    await expect(register("Alice", PASSWORD, PASSWORD)).resolves.toMatchObject({
      error: "RATE_LIMITED",
    });
  });

  it("a changed X-Forwarded-For does not get around the limit", async () => {
    for (let i = 0; i < REGISTRATION_LIMIT.max; i++) {
      fromAddress("203.0.113.7", `198.51.100.${i}`);
      await register(`user-${i}`, PASSWORD, PASSWORD);
    }
    fromAddress("203.0.113.7", "192.0.2.1");
    await expect(
      register("one-more", PASSWORD, PASSWORD),
    ).resolves.toMatchObject({ error: "RATE_LIMITED" });
  });

  it("without a trusted address clients do not share one limit", async () => {
    vi.unstubAllEnvs();
    for (let i = 0; i < REGISTRATION_LIMIT.max + 2; i++) {
      await expect(register(`user-${i}`, PASSWORD, PASSWORD)).resolves.toEqual({
        ok: true,
      });
    }
  });

  it("sends a new account to sign in when the login limit blocks it", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError());
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(register("Alice", PASSWORD, PASSWORD)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith({
      href: "/?auth=login",
      locale: "en",
    });
    await expect(User.countDocuments()).resolves.toBe(1);
  });
});
