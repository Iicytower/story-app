import { describe, expect, it } from "vitest";
import {
  findUnusedCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
  storeRecoveryCodes,
} from "./recovery-codes";

process.env.AUTH_SECRET = "unit-test-secret";

describe("recovery codes", () => {
  it("generates ten different codes in the XXXX-XXXX-XXXX format", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(
        /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){2}$/,
      );
    }
  });

  it("stores a keyed hash, never the code", () => {
    const [code] = generateRecoveryCodes();
    const [stored] = storeRecoveryCodes([code]);
    expect(stored).toEqual({ hash: hashRecoveryCode(code), usedAt: null });
    expect(stored.hash).not.toContain(code.replace(/-/g, ""));
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores case, spaces and dashes and reads look-alike letters as digits", () => {
    expect(normalizeRecoveryCode(" abcd-ef0h 1jkm ")).toBe("ABCDEF0H1JKM");
    expect(hashRecoveryCode("ABCD-EFOH-IJKM")).toBe(
      hashRecoveryCode("abcd ef0h 1jkm"),
    );
    expect(hashRecoveryCode("ABCD-EFGH-LJKM")).toBe(
      hashRecoveryCode("ABCD-EFGH-1JKM"),
    );
  });

  it("finds only an unused code", () => {
    const codes = generateRecoveryCodes();
    const stored = storeRecoveryCodes(codes);
    expect(findUnusedCode(stored, codes[3])).toBe(stored[3].hash);
    stored[3].usedAt = new Date();
    expect(findUnusedCode(stored, codes[3])).toBeNull();
    expect(findUnusedCode(stored, "AAAA-BBBB-CCCC")).toBeNull();
    expect(findUnusedCode(undefined, codes[0])).toBeNull();
  });
});
