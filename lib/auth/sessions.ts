import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { AuthSession } from "@/lib/models/session";

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
const MAX_AGE_MS = SESSION_MAX_AGE_S * 1000;
// The JWT is re-signed on every visit, so the stored expiry follows it, at most once a day.
const EXTEND_AFTER_MS = 24 * 60 * 60 * 1000;
// auth() runs several times per request (proxy, layout, page, action); a short cache spares the
// database. Another server instance may see a revoked session for up to this long.
const CACHE_MS = 10_000;
const CACHE_LIMIT = 1000;

const active = new Map<string, number>();

export async function createSession(userId: string): Promise<string> {
  await connectDB();
  const id = randomBytes(32).toString("base64url");
  await AuthSession.create({
    _id: id,
    userId,
    expiresAt: new Date(Date.now() + MAX_AGE_MS),
  });
  return id;
}

export async function isSessionActive(
  id: unknown,
  userId: unknown,
): Promise<boolean> {
  if (typeof id !== "string" || typeof userId !== "string") return false;
  const cachedUntil = active.get(id);
  if (cachedUntil !== undefined && cachedUntil > Date.now()) return true;

  await connectDB();
  const session = await AuthSession.findOne({
    _id: id,
    userId,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) {
    active.delete(id);
    return false;
  }
  if (session.expiresAt.getTime() - Date.now() < MAX_AGE_MS - EXTEND_AFTER_MS) {
    await AuthSession.updateOne(
      { _id: id },
      { $set: { expiresAt: new Date(Date.now() + MAX_AGE_MS) } },
    );
  }
  if (active.size >= CACHE_LIMIT) active.clear();
  active.set(id, Date.now() + CACHE_MS);
  return true;
}

export async function endSession(id: unknown): Promise<void> {
  if (typeof id !== "string") return;
  active.delete(id);
  await connectDB();
  await AuthSession.deleteOne({ _id: id });
}

// keep: the session the request came from, which stays signed in.
export async function endOtherSessions(
  userId: string,
  keep: string | null,
): Promise<void> {
  await connectDB();
  const filter = { userId, ...(keep && { _id: { $ne: keep } }) };
  const ids = await AuthSession.find(filter).distinct("_id");
  for (const id of ids) active.delete(id);
  await AuthSession.deleteMany({ _id: { $in: ids } });
}
