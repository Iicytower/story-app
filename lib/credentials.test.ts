import { describe, expect, it } from "vitest";
import { nicknameError, passwordError } from "./credentials";

const VALID_PASSWORD = "Abcdefghijklmno1!";

describe("nicknameError", () => {
  it.each(["abc", "Alice_01", "a-b", "x".repeat(30)])("accepts %s", (nick) => {
    expect(nicknameError(nick)).toBeNull();
  });

  it.each(["ab", "x".repeat(31), "al ice", "żółw", "a@b", ""])(
    "rejects %j",
    (nick) => {
      expect(nicknameError(nick)).not.toBeNull();
    },
  );
});

describe("passwordError", () => {
  it("accepts a password meeting every requirement", () => {
    expect(passwordError(VALID_PASSWORD)).toBeNull();
  });

  it("rejects a password below the minimum length", () => {
    expect(passwordError("Abcdefghijklmn1!")).toMatch(/at least 17/);
  });

  it("accepts a password at the maximum length and rejects a longer one", () => {
    expect(passwordError(VALID_PASSWORD.padEnd(256, "x"))).toBeNull();
    expect(passwordError(VALID_PASSWORD.padEnd(257, "x"))).toMatch(
      /at most 256/,
    );
  });

  it("counts characters, not UTF-16 units", () => {
    expect(passwordError(VALID_PASSWORD.padEnd(16, "😀"))).toBeNull();
    expect(passwordError("Aa1!" + "😀".repeat(12))).toMatch(/at least 17/);
  });

  it("requires a lowercase letter", () => {
    expect(passwordError("ABCDEFGHIJKLMNO1!")).toMatch(/lowercase/);
  });

  it("requires an uppercase letter", () => {
    expect(passwordError("abcdefghijklmno1!")).toMatch(/uppercase/);
  });

  it("requires a digit", () => {
    expect(passwordError("Abcdefghijklmnop!")).toMatch(/digit/);
  });

  it("requires an ASCII special character", () => {
    expect(passwordError("Abcdefghijklmnop1")).toMatch(/special/);
    expect(passwordError("Abcdefghijklmn1 😀")).toMatch(/special/);
  });

  it.each(["!", "/", ":", "@", "[", "`", "{", "~"])("accepts %s", (char) => {
    expect(passwordError(`Abcdefghijklmno1${char}`)).toBeNull();
  });
});
