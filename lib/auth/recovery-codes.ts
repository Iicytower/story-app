import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// D76. Crockford's base32: no I, L, O or U, so a code copied by hand is hard to misread.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RECOVERY_CODE_COUNT = 10;
const GROUPS = 3;
const GROUP_LENGTH = 4;

export interface StoredRecoveryCode {
  hash: string;
  usedAt: Date | null;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    Array.from({ length: GROUPS }, () =>
      Array.from(
        { length: GROUP_LENGTH },
        () => ALPHABET[randomInt(ALPHABET.length)],
      ).join(""),
    ).join("-"),
  );
}

// Spaces, dashes and case do not matter, and the letters Crockford's base32 leaves out read as
// the digits they look like.
export function normalizeRecoveryCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

// 60 random bits need no slow hash; the key keeps a stolen database from checking guesses offline.
// Changing AUTH_SECRET makes every stored code invalid.
export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", `recovery-codes:${process.env.AUTH_SECRET!}`)
    .update(normalizeRecoveryCode(code))
    .digest("hex");
}

export function storeRecoveryCodes(codes: string[]): StoredRecoveryCode[] {
  return codes.map((code) => ({ hash: hashRecoveryCode(code), usedAt: null }));
}

// Compares with every unused code in constant time per code. Returns the matching hash.
export function findUnusedCode(
  stored: StoredRecoveryCode[] | undefined,
  code: string,
): string | null {
  const wanted = Buffer.from(hashRecoveryCode(code), "hex");
  let found: string | null = null;
  for (const { hash, usedAt } of stored ?? []) {
    const candidate = Buffer.from(hash, "hex");
    const same =
      candidate.length === wanted.length && timingSafeEqual(candidate, wanted);
    if (same && usedAt === null) found = hash;
  }
  return found;
}
