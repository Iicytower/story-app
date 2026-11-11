import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRealtimeToken, REALTIME_TOKEN_TTL_MS } from "./realtime-token";

// The service (docker/tools/realtime/server.mjs) checks the token: realtime-service.test.ts.
const SECRET = "tools-secret";
const USER = "0123456789abcdef01234567";
const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);

const signature = (secret: string, payload: string) =>
  createHmac(
    "sha256",
    createHmac("sha256", secret).update("story-app realtime token").digest(),
  )
    .update(payload)
    .digest("base64url");

describe("realtime token (task 90)", () => {
  it("is signed for the user with a key derived from the secret", () => {
    const { token } = createRealtimeToken(USER, SECRET, NOW);
    const [user, exp, signed, ...rest] = token.split(".");
    expect(rest).toEqual([]);
    expect(user).toBe(USER);
    expect(signed).toBe(signature(SECRET, `${USER}.${exp}`));
    expect(signed).not.toBe(signature("other", `${USER}.${exp}`));
    expect(token).not.toContain(SECRET);
  });

  it("expires after 10 minutes", () => {
    const { token, expiresAt } = createRealtimeToken(USER, SECRET, NOW);
    expect(REALTIME_TOKEN_TTL_MS).toBe(10 * 60_000);
    expect(expiresAt).toBe(NOW + REALTIME_TOKEN_TTL_MS);
    expect(Number(token.split(".")[1]) * 1000).toBe(expiresAt);
    // Whole seconds: never later than ten minutes.
    expect(createRealtimeToken(USER, SECRET, NOW + 999).expiresAt).toBe(
      expiresAt,
    );
  });
});
