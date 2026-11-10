import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recoverAccount } from "@/app/[locale]/auth/recover-actions";
import { register } from "@/app/[locale]/auth/register-actions";
import { signIn } from "@/auth";
import { createOrUpdateUser, verifyPassword } from "@/lib/accounts";
import { createSession, isSessionActive } from "@/lib/auth/sessions";
import { User } from "@/lib/models/user";
import { RECOVERY_ACCOUNT_LIMIT } from "@/lib/rate-limit";
import { setupTestDb } from "./test-db";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));

vi.setConfig({ testTimeout: 60_000 });

setupTestDb();

const PASSWORD = "Correct-horse-12345";
const NEW_PASSWORD = "Battery-staple-12345";

beforeEach(() => {
  vi.mocked(signIn).mockReset();
  vi.mocked(headers).mockResolvedValue(new Headers() as never);
});

async function registered(): Promise<string[]> {
  const result = await register("Alice", PASSWORD, PASSWORD);
  if (!result.ok) throw new Error(result.message);
  return result.recoveryCodes;
}

const account = () => User.findOne({ nickname: "Alice" }).lean();

describe("recovery codes at registration", () => {
  it("returns ten codes once and stores only their hashes", async () => {
    const codes = await registered();
    expect(codes).toHaveLength(10);
    const stored = (await account())!.recoveryCodes!;
    expect(stored).toHaveLength(10);
    const raw = JSON.stringify(await User.collection.findOne({}));
    for (const code of codes) {
      expect(raw).not.toContain(code);
      expect(raw).not.toContain(code.replace(/-/g, ""));
    }
    expect(stored.every(({ usedAt }) => usedAt === null)).toBe(true);
  });
});

describe("recoverAccount", () => {
  it("sets a new password with an unused code, and the code works only once", async () => {
    const codes = await registered();
    const result = await recoverAccount(
      "alice",
      codes[2],
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    expect(result).toMatchObject({ ok: true, signedIn: true });
    const user = (await account())!;
    expect(await verifyPassword(NEW_PASSWORD, user.passwordHash)).toBe(true);
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(false);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      nickname: "alice",
      password: NEW_PASSWORD,
      redirect: false,
    });

    await expect(
      recoverAccount("alice", codes[2], PASSWORD, PASSWORD),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });

  it("gives a new set of codes that replaces the old one", async () => {
    const codes = await registered();
    const result = await recoverAccount(
      "Alice",
      codes[0],
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(result.recoveryCodes).not.toContain(codes[1]);
    await expect(
      recoverAccount("Alice", codes[1], PASSWORD, PASSWORD),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      recoverAccount("Alice", result.recoveryCodes[0], PASSWORD, PASSWORD),
    ).resolves.toMatchObject({ ok: true });
  });

  it("ends every session of the account", async () => {
    const codes = await registered();
    const id = (await account())!._id.toString();
    const session = await createSession(id);
    await recoverAccount("Alice", codes[0], NEW_PASSWORD, NEW_PASSWORD);
    await expect(isSessionActive(session, id)).resolves.toBe(false);
  });

  it("a wrong code, a used code and an unknown nickname get the same answer", async () => {
    const codes = await registered();
    await recoverAccount("Alice", codes[0], NEW_PASSWORD, NEW_PASSWORD);
    await createOrUpdateUser("Bob", "Granite-path-1357913");
    const answers = await Promise.all([
      recoverAccount("Alice", "AAAA-BBBB-CCCC", PASSWORD, PASSWORD),
      recoverAccount("Alice", codes[0], PASSWORD, PASSWORD),
      recoverAccount("Nobody", codes[1], PASSWORD, PASSWORD),
      // An account from before task 63 has no codes.
      recoverAccount("Bob", codes[1], PASSWORD, PASSWORD),
    ]);
    for (const answer of answers) {
      expect(answer).toEqual(answers[0]);
    }
    expect(answers[0]).toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
      message: expect.stringMatching(/recovery code is not valid/),
    });
  });

  it("refuses more than five wrong codes for one nickname", async () => {
    const codes = await registered();
    for (let i = 0; i < RECOVERY_ACCOUNT_LIMIT.max; i++) {
      await recoverAccount(
        "Alice",
        `WRNG-0000-000${i}`,
        NEW_PASSWORD,
        NEW_PASSWORD,
      );
    }
    await expect(
      recoverAccount("Alice", codes[0], NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many attempts. Try again in a few minutes.",
    });
    expect(
      await verifyPassword(PASSWORD, (await account())!.passwordHash),
    ).toBe(true);
  });

  it("checks the new password fully, including the nickname", async () => {
    const codes = await registered();
    for (const [password, message] of [
      ["short", /at least 17/],
      ["Alice-river-Mountain9!", /nickname/],
      ["aaaaaaaaaaaaaaaA1!", /repeats/],
    ] as const) {
      const result = await recoverAccount(
        "Alice",
        codes[0],
        password,
        password,
      );
      expect(result).toMatchObject({
        ok: false,
        error: "INVALID_INPUT",
        message: expect.stringMatching(message),
      });
    }
    await expect(
      recoverAccount("Alice", codes[0], NEW_PASSWORD, "different"),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
    // None of these used the code.
    await expect(
      recoverAccount("Alice", codes[0], NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toMatchObject({ ok: true });
  });

  it("rejects input that is not text", async () => {
    await expect(recoverAccount(1, [], null, {})).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
  });
});
