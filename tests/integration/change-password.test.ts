import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "@/app/(protected)/actions";
import { createOrUpdateUser, verifyPassword } from "@/lib/accounts";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/auth/session";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));

setupTestDb();

const PASSWORD = "Correct-horse-12345";
const NEW_PASSWORD = "Battery-staple-12345";
const BOB_PASSWORD = "Bob-password-1234567";

let alice: Types.ObjectId;
let bob: Types.ObjectId;

async function passwordHashOf(id: Types.ObjectId): Promise<string> {
  return (await User.findById(id).lean())!.passwordHash;
}

beforeEach(async () => {
  await createOrUpdateUser("alice", PASSWORD);
  await createOrUpdateUser("bob", BOB_PASSWORD);
  alice = (await User.findOne({ nickname: "alice" }))!._id;
  bob = (await User.findOne({ nickname: "bob" }))!._id;
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice.toString(),
  });
});

describe("changePassword", () => {
  it("replaces the old password, so only the new one signs in", async () => {
    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({ ok: true });

    await expect(
      authorizeCredentials({ nickname: "alice", password: NEW_PASSWORD }),
    ).resolves.toMatchObject({ name: "alice" });
    await expect(
      authorizeCredentials({ nickname: "alice", password: PASSWORD }),
    ).resolves.toBeNull();
  });

  it("rejects a wrong current password and keeps the old hash", async () => {
    const before = await passwordHashOf(alice);

    await expect(
      changePassword("Wrong-password-12345", NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({
      ok: false,
      error: "INVALID_INPUT",
      message: "The current password is incorrect.",
    });
    await expect(passwordHashOf(alice)).resolves.toBe(before);
  });

  it.each([
    ["too short", "Abcdefghijklmn1!", /at least 17/],
    ["no lowercase letter", "ABCDEFGHIJKLMNO1!", /lowercase/],
    ["no uppercase letter", "abcdefghijklmno1!", /uppercase/],
    ["no digit", "Abcdefghijklmnop!", /digit/],
    ["no special character", "Abcdefghijklmnop1", /special/],
  ])("rejects a new password with %s", async (_, password, message) => {
    const before = await passwordHashOf(alice);

    const result = await changePassword(PASSWORD, password, password);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(result).toHaveProperty("message", expect.stringMatching(message));
    await expect(passwordHashOf(alice)).resolves.toBe(before);
  });

  it("rejects a repeated password that differs", async () => {
    const before = await passwordHashOf(alice);

    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, `${NEW_PASSWORD}x`),
    ).resolves.toMatchObject({
      ok: false,
      message: "The new passwords do not match.",
    });
    await expect(passwordHashOf(alice)).resolves.toBe(before);
  });

  it("rejects input that is not text", async () => {
    await expect(
      changePassword(PASSWORD, null, undefined),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });

  it("requires a session", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again.",
    });
    const before = await passwordHashOf(alice);

    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toMatchObject({ ok: false, error: "UNAUTHORIZED" });
    await expect(passwordHashOf(alice)).resolves.toBe(before);
  });

  it("changes only the account from the session", async () => {
    const before = await passwordHashOf(bob);

    await changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD);

    await expect(passwordHashOf(bob)).resolves.toBe(before);
    await expect(
      verifyPassword(BOB_PASSWORD, await passwordHashOf(bob)),
    ).resolves.toBe(true);
  });

  it("checks the password of the session account, not another one", async () => {
    await expect(
      changePassword(BOB_PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toMatchObject({
      ok: false,
      message: "The current password is incorrect.",
    });
  });
});
