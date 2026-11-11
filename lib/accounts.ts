import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { StoredRecoveryCode } from "@/lib/auth/recovery-codes";
import { nicknameError, passwordError } from "@/lib/credentials";
import { isDuplicateKeyError } from "@/lib/db";
import { inEnglish } from "@/lib/i18n/english";
import { NICKNAME_COLLATION, NOT_DELETED, User } from "@/lib/models/user";

// Hashes without the prefix are bcrypt of the raw password, from before task 36.
const PREHASHED_PREFIX = "sha256$";

// bcrypt ignores everything past 72 bytes; hex keeps the digest free of NUL bytes.
function prehash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return PREHASHED_PREFIX + (await bcrypt.hash(prehash(password), 12));
}

export async function verifyPassword(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  if (passwordHash === undefined) return false;
  return passwordHash.startsWith(PREHASHED_PREFIX)
    ? bcrypt.compare(
        prehash(password),
        passwordHash.slice(PREHASHED_PREFIX.length),
      )
    : bcrypt.compare(password, passwordHash);
}

export function findUserByNickname(nickname: string) {
  return User.findOne({ nickname: nickname.trim(), ...NOT_DELETED })
    .collation(NICKNAME_COLLATION)
    .lean();
}

// A deleted account's nickname counts as taken (D37, task 89).
export async function userExists(nickname: string): Promise<boolean> {
  const user = await User.exists({ nickname: nickname.trim() }).collation(
    NICKNAME_COLLATION,
  );
  return user !== null;
}

// Insert only: unlike createOrUpdateUser it must never touch an existing account.
// The unique index decides, which also settles two simultaneous registrations.
export async function createUser(
  nickname: string,
  password: string,
  recoveryCodes?: StoredRecoveryCode[],
): Promise<boolean> {
  try {
    await User.create({
      nickname,
      passwordHash: await hashPassword(password),
      recoveryCodes,
    });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

export async function createOrUpdateUser(
  nickname: string,
  password: string,
): Promise<"created" | "updated"> {
  const trimmed = nickname.trim();
  const error = nicknameError(trimmed) ?? passwordError(password, trimmed);
  if (error) throw new Error(inEnglish(error));

  // A deleted account's tombstone matches no filter, so the insert hits the unique index.
  const result = await User.updateOne(
    { nickname: trimmed, ...NOT_DELETED },
    { $set: { passwordHash: await hashPassword(password) } },
    { upsert: true, collation: NICKNAME_COLLATION },
  ).catch((error: unknown) => {
    if (isDuplicateKeyError(error)) {
      throw new Error("This nickname belongs to a deleted account.");
    }
    throw error;
  });
  return result.upsertedCount > 0 ? "created" : "updated";
}
