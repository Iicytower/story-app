import { createHmac } from "node:crypto";
import { isIPv6 } from "node:net";
import { isDuplicateKeyError } from "@/lib/db";
import { RateLimit } from "@/lib/models/rate-limit";

export interface RateLimitRule {
  name: string;
  max: number;
  windowMs: number;
}

export const REGISTRATION_LIMIT: RateLimitRule = {
  name: "register",
  max: 5,
  windowMs: 60 * 60 * 1000,
};

export const LOGIN_LIMIT: RateLimitRule = {
  name: "login",
  max: 20,
  windowMs: 15 * 60 * 1000,
};

export const SEARCH_LIMIT: RateLimitRule = {
  name: "search",
  max: 30,
  windowMs: 60 * 1000,
};

// Per user, not per IP: one check keeps the tools server's CPU busy for seconds (D58).
export const PROOFREAD_LIMIT: RateLimitRule = {
  name: "proofread",
  max: 10,
  windowMs: 10 * 60 * 1000,
};

// One subscriber usually owns a whole IPv6 /64, so single addresses would not limit anyone.
function ipv6Network(ip: string): string {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = ip.includes("::")
    ? Array<string>(8 - left.length - right.length).fill("0")
    : [];
  const groups = [...left, ...zeros, ...right].slice(0, 4);
  return `${groups.map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (!forwarded) return "unknown";
  const ip = forwarded.replace(/^::ffff:(?=\d+\.)/i, "");
  return isIPv6(ip) ? ipv6Network(ip) : ip;
}

function slotId(rule: RateLimitRule, ip: string, windowStart: number): string {
  const client = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(ip)
    .digest("hex");
  return `${rule.name}:${client}:${windowStart}`;
}

function increment(id: string, expiresAt: Date) {
  return RateLimit.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" },
  ).lean();
}

// Counts first and checks after, so parallel requests cannot all pass a read of the same count.
// Returns the slot for giveBackAttempt, or null over the limit.
export async function takeAttempt(
  rule: RateLimitRule,
  ip: string,
): Promise<string | null> {
  const windowStart = Math.floor(Date.now() / rule.windowMs) * rule.windowMs;
  const id = slotId(rule, ip, windowStart);
  const expiresAt = new Date(windowStart + rule.windowMs);
  const slot = await increment(id, expiresAt).catch((error: unknown) => {
    if (isDuplicateKeyError(error)) return increment(id, expiresAt);
    throw error;
  });
  return slot.count <= rule.max ? id : null;
}

export async function giveBackAttempt(slot: string): Promise<void> {
  await RateLimit.updateOne({ _id: slot }, { $inc: { count: -1 } });
}
