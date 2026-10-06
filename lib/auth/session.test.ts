import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "./session";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));

describe("requireUser", () => {
  beforeEach(() => auth.mockReset());

  it("returns UNAUTHORIZED without a session", async () => {
    auth.mockResolvedValue(null);
    await expect(requireUser()).resolves.toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("returns UNAUTHORIZED when the session has no user id", async () => {
    auth.mockResolvedValue({ user: { email: "alice@example.com" } });
    await expect(requireUser()).resolves.toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("returns the user id from the session", async () => {
    auth.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireUser()).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
  });
});
