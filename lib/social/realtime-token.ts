import { createHmac } from "node:crypto";

// D80, task 90: the token of the realtime stream, checked by docker/tools/realtime/server.mjs
// with the same derivation. The tools secret itself never leaves the server.
export const REALTIME_TOKEN_TTL_MS = 10 * 60_000;

const keyOf = (secret: string) =>
  createHmac("sha256", secret).update("story-app realtime token").digest();

const sign = (secret: string, payload: string) =>
  createHmac("sha256", keyOf(secret)).update(payload).digest("base64url");

// "<userId>.<exp in seconds>.<signature>"
export function createRealtimeToken(
  userId: string,
  secret: string,
  now = Date.now(),
): { token: string; expiresAt: number } {
  const exp = Math.floor((now + REALTIME_TOKEN_TTL_MS) / 1000);
  const payload = `${userId}.${exp}`;
  return {
    token: `${payload}.${sign(secret, payload)}`,
    expiresAt: exp * 1000,
  };
}
