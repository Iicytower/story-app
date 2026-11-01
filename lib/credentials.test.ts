import { describe, expect, it } from "vitest";
import {
  nicknameError,
  passwordChecklist,
  PASSWORD_REQUIREMENTS,
  PASSWORD_SPECIAL_CHARACTERS,
  passwordError,
} from "./credentials";

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

describe("PASSWORD_REQUIREMENTS", () => {
  it("states the limits passwordError enforces", () => {
    expect(PASSWORD_REQUIREMENTS[0]).toBe("17-256 characters");
  });

  it("lists exactly the special characters passwordError accepts", () => {
    const ascii = Array.from({ length: 127 - 32 }, (_, i) =>
      String.fromCharCode(i + 32),
    );
    const accepted = ascii.filter(
      (char) => passwordError(`Abcdefghijklmno1${char}`) === null,
    );
    expect(accepted.join("")).toBe(PASSWORD_SPECIAL_CHARACTERS);
  });
});

describe("passwordChecklist", () => {
  function missing(password: string) {
    return passwordChecklist(password)
      .filter(({ met }) => !met)
      .map(({ requirement }) => requirement);
  }

  it("keeps the order and text of PASSWORD_REQUIREMENTS", () => {
    expect(passwordChecklist("").map(({ requirement }) => requirement)).toEqual(
      PASSWORD_REQUIREMENTS,
    );
  });

  it("reports every requirement as missing for an empty password", () => {
    expect(missing("")).toEqual(PASSWORD_REQUIREMENTS);
  });

  it.each([
    ["Abcdefghijklmn1!", 0],
    [VALID_PASSWORD.padEnd(257, "x"), 0],
    ["ABCDEFGHIJKLMNO1!", 1],
    ["abcdefghijklmno1!", 2],
    ["Abcdefghijklmnop!", 3],
    ["Abcdefghijklmnop1", 4],
  ])("marks only the unmet requirement for %s", (password, index) => {
    expect(missing(password)).toEqual([PASSWORD_REQUIREMENTS[index]]);
  });

  it.each([
    VALID_PASSWORD,
    "",
    "Aa1!",
    "Abcdefghijklmn1 😀",
    "Ąbcdefghijklmnoż1!",
    VALID_PASSWORD.padEnd(256, "x"),
    VALID_PASSWORD.padEnd(257, "x"),
  ])("agrees with passwordError for %j", (password) => {
    expect(missing(password).length === 0).toBe(
      passwordError(password) === null,
    );
  });
});
