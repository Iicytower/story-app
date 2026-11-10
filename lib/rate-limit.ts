import { createHmac } from "node:crypto";
import { isIPv6 } from "node:net";
import { isDuplicateKeyError } from "@/lib/db";
import { RateLimit } from "@/lib/models/rate-limit";
import { User } from "@/lib/models/user";

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

// Per nickname, from any address (D74). It also blocks the right password until the window
// ends, so the owner can be locked out for at most an hour.
export const LOGIN_ACCOUNT_LIMIT: RateLimitRule = {
  name: "login-account",
  max: 20,
  windowMs: 60 * 60 * 1000,
};

export const SEARCH_LIMIT: RateLimitRule = {
  name: "search",
  max: 30,
  windowMs: 60 * 1000,
};

// Wrong recovery codes (D76): per address like signing in, and few per account.
export const RECOVERY_LIMIT: RateLimitRule = {
  name: "recover",
  max: 20,
  windowMs: 15 * 60 * 1000,
};

export const RECOVERY_ACCOUNT_LIMIT: RateLimitRule = {
  name: "recover-account",
  max: 5,
  windowMs: 60 * 60 * 1000,
};

// Wrong current passwords per user (F4, D75).
export const CHANGE_PASSWORD_LIMIT: RateLimitRule = {
  name: "change-password",
  max: 5,
  windowMs: 15 * 60 * 1000,
};

// Per user, not per IP: one check keeps the tools server's CPU busy for seconds (D58).
export const PROOFREAD_LIMIT: RateLimitRule = {
  name: "proofread",
  max: 10,
  windowMs: 10 * 60 * 1000,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Anti-spam per account (D80). An action with a limit per minute and per day takes both.
// Every rule has its own name: a minute and a day window start together at midnight.
export const SOCIAL_LIMITS = {
  commentMinute: { name: "comment-minute", max: 10, windowMs: MINUTE },
  commentDay: { name: "comment-day", max: 200, windowMs: DAY },
  postMinute: { name: "post-minute", max: 5, windowMs: MINUTE },
  postDay: { name: "post-day", max: 100, windowMs: DAY },
  threadDay: { name: "thread-day", max: 10, windowMs: DAY },
  dmMinute: { name: "dm-minute", max: 30, windowMs: MINUTE },
  conversationDay: { name: "conversation-day", max: 10, windowMs: DAY },
  reportDay: { name: "report-day", max: 20, windowMs: DAY },
  react: { name: "react", max: 60, windowMs: MINUTE },
  rate: { name: "rate", max: 60, windowMs: MINUTE },
  follow: { name: "follow", max: 60, windowMs: MINUTE },
  block: { name: "block", max: 60, windowMs: MINUTE },
  suggest: { name: "suggest", max: 60, windowMs: MINUTE },
  // Each one is a classifier call (task 70).
  avatarDay: { name: "avatar-day", max: 20, windowMs: DAY },
} as const satisfies Record<string, RateLimitRule>;

const NEW_ACCOUNT_MS = DAY;

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

// Only a header the platform sets and the client cannot (D74): X-Forwarded-For is whatever the
// client sends unless a proxy rewrites it. TRUSTED_IP_HEADER names another such header (E2E tests,
// a host other than Vercel).
function trustedIpHeader(): string | null {
  return (
    process.env.TRUSTED_IP_HEADER ||
    (process.env.VERCEL ? "x-vercel-forwarded-for" : null)
  );
}

let warned = false;

// Null without a trusted address: limits per address are then off, because one shared bucket
// would let anyone block everyone.
export function clientIp(headers: Headers): string | null {
  const name = trustedIpHeader();
  const value = name ? headers.get(name)?.split(",")[0].trim() : undefined;
  if (!value) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.warn(
        "No trusted client address (VERCEL or TRUSTED_IP_HEADER): rate limits per address are off.",
      );
    }
    return null;
  }
  const ip = value.replace(/^::ffff:(?=\d+\.)/i, "");
  return isIPv6(ip) ? ipv6Network(ip) : ip;
}

// Case-insensitive, like the nickname index (NICKNAME_COLLATION), so "Alice" and "alice" share it.
export function accountKey(nickname: string): string {
  return nickname.trim().toLowerCase();
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

// A slot of null is an attempt that was not counted: there was no trusted address.
export async function takeIpAttempt(
  rule: RateLimitRule,
  headers: Headers,
): Promise<{ slot: string | null } | null> {
  const ip = clientIp(headers);
  if (ip === null) return { slot: null };
  const slot = await takeAttempt(rule, ip);
  return slot ? { slot } : null;
}

// Per account; an account younger than 24 hours gets half of the limit (D80). An account
// that is gone is counted as new.
export async function takeUserAttempt(
  rule: RateLimitRule,
  userId: string,
): Promise<string | null> {
  const user = await User.findById(userId, { createdAt: 1 }).lean();
  const young = !user || Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_MS;
  return takeAttempt(
    young ? { ...rule, max: Math.floor(rule.max / 2) } : rule,
    userId,
  );
}

export async function giveBackAttempt(slot: string | null): Promise<void> {
  if (slot === null) return;
  await RateLimit.updateOne({ _id: slot }, { $inc: { count: -1 } });
}
