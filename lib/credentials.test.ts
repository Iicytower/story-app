import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import {
  nicknameError,
  passwordChecklist,
  PASSWORD_REQUIREMENT_VALUES,
  PASSWORD_REQUIREMENTS,
  PASSWORD_SPECIAL_CHARACTERS,
  passwordError,
} from "./credentials";

const t = createTranslator({
  locale: "en",
  messages: en,
  namespace: "password",
});

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
    expect(passwordError("Abcdefghijklmn1!")).toEqual({
      key: "passwordTooShort",
      values: { min: 17 },
    });
  });

  it("accepts a password at the maximum length and rejects a longer one", () => {
    expect(passwordError(VALID_PASSWORD.padEnd(256, "x"))).toBeNull();
    expect(passwordError(VALID_PASSWORD.padEnd(257, "x"))).toEqual({
      key: "passwordTooLong",
      values: { max: 256 },
    });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(passwordError(VALID_PASSWORD.padEnd(16, "😀"))).toBeNull();
    expect(passwordError("Aa1!" + "😀".repeat(12))).toEqual({
      key: "passwordTooShort",
      values: { min: 17 },
    });
  });

  it("requires a lowercase letter", () => {
    expect(passwordError("ABCDEFGHIJKLMNO1!")).toEqual({
      key: "passwordNoLowercase",
    });
  });

  it("requires an uppercase letter", () => {
    expect(passwordError("abcdefghijklmno1!")).toEqual({
      key: "passwordNoUppercase",
    });
  });

  it("requires a digit", () => {
    expect(passwordError("Abcdefghijklmnop!")).toEqual({
      key: "passwordNoDigit",
    });
  });

  it("requires an ASCII special character", () => {
    expect(passwordError("Abcdefghijklmnop1")).toEqual({
      key: "passwordNoSpecial",
    });
    expect(passwordError("Abcdefghijklmn1 😀")).toEqual({
      key: "passwordNoSpecial",
    });
  });

  it.each(["!", "/", ":", "@", "[", "`", "{", "~"])("accepts %s", (char) => {
    expect(passwordError(`Abcdefghijklmno1${char}`)).toBeNull();
  });
});

describe("PASSWORD_REQUIREMENTS", () => {
  it("states the limits passwordError enforces", () => {
    expect(
      t(
        `requirements.${PASSWORD_REQUIREMENTS[0]}`,
        PASSWORD_REQUIREMENT_VALUES,
      ),
    ).toBe("17-256 characters");
    expect(
      t(
        `requirements.${PASSWORD_REQUIREMENTS[4]}`,
        PASSWORD_REQUIREMENT_VALUES,
      ),
    ).toBe(`A special character, one of: ${PASSWORD_SPECIAL_CHARACTERS}`);
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

  it("keeps the order of PASSWORD_REQUIREMENTS", () => {
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
