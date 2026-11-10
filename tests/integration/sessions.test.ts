import type { JWT } from "@auth/core/jwt";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  logOutOtherDevices,
} from "@/app/[locale]/(protected)/actions";
import { createOrUpdateUser } from "@/lib/accounts";
import { sessionCallbacks, sessionEvents } from "@/lib/auth/callbacks";
import { requireUser } from "@/lib/auth/session";
import { createSession, isSessionActive } from "@/lib/auth/sessions";
import { AuthSession } from "@/lib/models/session";
import { User } from "@/lib/models/user";
import { CHANGE_PASSWORD_LIMIT } from "@/lib/rate-limit";
import { setupTestDb } from "./test-db";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));

vi.setConfig({ testTimeout: 30_000 });

setupTestDb();

const PASSWORD = "Correct-horse-12345";
const NEW_PASSWORD = "Battery-staple-12345";

let alice: string;

beforeEach(async () => {
  await createOrUpdateUser("alice", PASSWORD);
  alice = (await User.findOne({ nickname: "alice" }))!._id.toString();
});

// What Auth.js calls: once with the user at sign-in, then with the token on each request.
async function signIn(userId = alice): Promise<JWT> {
  const token = await sessionCallbacks.jwt({
    token: {},
    user: { id: userId },
  } as never);
  return token as JWT;
}

const check = (token: JWT) => sessionCallbacks.jwt({ token } as never);

function onDevice(token: JWT) {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId: alice,
    sessionId: token.sid,
  });
}

describe("stored sessions", () => {
  it("signing in stores a session the token points to", async () => {
    const token = await signIn();
    expect(token).toMatchObject({ id: alice, sid: expect.any(String) });
    const stored = await AuthSession.findById(token.sid).lean();
    expect(stored?.userId.toString()).toBe(alice);
    await expect(check(token)).resolves.toEqual(token);
  });

  it("a token copied before signing out does not work after it", async () => {
    const token = await signIn();
    const copy = { ...token };
    await sessionEvents.signOut({ token } as never);
    await expect(check(copy)).resolves.toBeNull();
  });

  it("refuses tokens without a stored session or for another user", async () => {
    await expect(check({ id: alice })).resolves.toBeNull();
    const token = await signIn();
    await expect(
      check({ ...token, id: new Types.ObjectId().toString() }),
    ).resolves.toBeNull();
    await expect(check({ ...token, sid: "made-up" })).resolves.toBeNull();
  });

  it("an expired session ends", async () => {
    const id = await createSession(alice);
    await AuthSession.updateOne(
      { _id: id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    await expect(isSessionActive(id, alice)).resolves.toBe(false);
  });

  it("puts the session id in the session for the actions", () => {
    const session = sessionCallbacks.session({
      session: { user: {} },
      token: { id: alice, sid: "abc" },
    } as never);
    expect(session).toMatchObject({ user: { id: alice }, sid: "abc" });
  });
});

describe("changePassword ends the other sessions", () => {
  it("keeps the device it was changed from signed in", async () => {
    const here = await signIn();
    const other = await signIn();
    const elsewhere = await signIn();
    onDevice(here);

    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({ ok: true });

    await expect(check(here)).resolves.not.toBeNull();
    await expect(check(other)).resolves.toBeNull();
    await expect(check(elsewhere)).resolves.toBeNull();
  });

  it("leaves sessions alone when the change fails", async () => {
    const here = await signIn();
    const other = await signIn();
    onDevice(here);
    await changePassword("Wrong-password-12345", NEW_PASSWORD, NEW_PASSWORD);
    await expect(check(other)).resolves.not.toBeNull();
  });

  it("does not touch another user's sessions", async () => {
    await createOrUpdateUser("bob", "Granite-path-1357913");
    const bob = (await User.findOne({ nickname: "bob" }))!._id.toString();
    const bobToken = await signIn(bob);
    onDevice(await signIn());
    await changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
    await expect(check(bobToken)).resolves.not.toBeNull();
  });
});

describe("logOutOtherDevices", () => {
  it("ends every other session of the user and keeps this one", async () => {
    const here = await signIn();
    const other = await signIn();
    onDevice(here);
    await expect(logOutOtherDevices()).resolves.toEqual({ ok: true });
    await expect(check(here)).resolves.not.toBeNull();
    await expect(check(other)).resolves.toBeNull();
  });

  it("requires a session", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "x",
    });
    await expect(logOutOtherDevices()).resolves.toMatchObject({
      error: "UNAUTHORIZED",
    });
  });
});

describe("changePassword limit", () => {
  beforeEach(async () => onDevice(await signIn()));

  it("refuses further attempts after too many wrong current passwords, even the right one", async () => {
    for (let i = 0; i < CHANGE_PASSWORD_LIMIT.max; i++) {
      await expect(
        changePassword("Wrong-password-12345", NEW_PASSWORD, NEW_PASSWORD),
      ).resolves.toMatchObject({ error: "INVALID_INPUT" });
    }
    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({
      ok: false,
      error: "RATE_LIMITED",
      message: "Too many attempts. Try again in a few minutes.",
    });
  });

  it("does not count successful changes or invalid new passwords", async () => {
    for (let i = 0; i < CHANGE_PASSWORD_LIMIT.max + 1; i++) {
      await changePassword(PASSWORD, "weak", "weak");
    }
    await expect(
      changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({ ok: true });
  });
});
