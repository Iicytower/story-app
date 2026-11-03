import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { nicknameError, passwordError } from "@/lib/credentials";
import { isDuplicateKeyError } from "@/lib/db";
import { NICKNAME_COLLATION, User } from "@/lib/models/user";

// Hashes without the prefix are bcrypt of the raw password, from before task 36.
const PREHASHED_PREFIX = "sha256$";

// bcrypt ignores everything past 72 bytes; hex keeps the digest free of NUL bytes.
function prehash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return PREHASHED_PREFIX + (await bcrypt.hash(prehash(password), 12));
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return passwordHash.startsWith(PREHASHED_PREFIX)
    ? bcrypt.compare(
        prehash(password),
        passwordHash.slice(PREHASHED_PREFIX.length),
      )
    : bcrypt.compare(password, passwordHash);
}

export function findUserByNickname(nickname: string) {
  return User.findOne({ nickname: nickname.trim() })
    .collation(NICKNAME_COLLATION)
    .lean();
}

export async function userExists(nickname: string): Promise<boolean> {
  return (await findUserByNickname(nickname)) !== null;
}

// Insert only: unlike createOrUpdateUser it must never touch an existing account.
// The unique index decides, which also settles two simultaneous registrations.
export async function createUser(
  nickname: string,
  password: string,
): Promise<boolean> {
  try {
    await User.create({ nickname, passwordHash: await hashPassword(password) });
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
  const error = nicknameError(trimmed) ?? passwordError(password);
  if (error) throw new Error(error);

  const result = await User.updateOne(
    { nickname: trimmed },
    { $set: { passwordHash: await hashPassword(password) } },
    { upsert: true, collation: NICKNAME_COLLATION },
  );
  return result.upsertedCount > 0 ? "created" : "updated";
}
