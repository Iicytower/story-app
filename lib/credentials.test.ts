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

const VALID_PASSWORD = "Ajrwbvzkqtmpnse1!";

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
    expect(passwordError("Ajrwbvzkqtmpns1!")).toEqual({
      key: "passwordTooShort",
      values: { min: 17 },
    });
  });

  it("accepts a password at the maximum length and rejects a longer one", () => {
    expect(passwordError(VALID_PASSWORD.padEnd(256, "xy3Q"))).toBeNull();
    expect(passwordError(VALID_PASSWORD.padEnd(257, "xy3Q"))).toEqual({
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
    expect(passwordError("AJRWBVZKQTMPNSE1!")).toEqual({
      key: "passwordNoLowercase",
    });
  });

  it("requires an uppercase letter", () => {
    expect(passwordError("ajrwbvzkqtmpnse1!")).toEqual({
      key: "passwordNoUppercase",
    });
  });

  it("requires a digit", () => {
    expect(passwordError("Ajrwbvzkqtmpnsey!")).toEqual({
      key: "passwordNoDigit",
    });
  });

  it("requires an ASCII special character", () => {
    expect(passwordError("Ajrwbvzkqtmpnsey1")).toEqual({
      key: "passwordNoSpecial",
    });
    expect(passwordError("Ajrwbvzkqtmpns1 😀")).toEqual({
      key: "passwordNoSpecial",
    });
  });

  it.each(["!", "/", ":", "@", "[", "`", "{", "~"])("accepts %s", (char) => {
    expect(passwordError(`Ajrwbvzkqtmpnse1${char}`)).toBeNull();
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
      (char) => passwordError(`Ajrwbvzkqtmpnse1${char}`) === null,
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
    ["Ajrwbvzkqtmpns1!", 0],
    [VALID_PASSWORD.padEnd(257, "xy3Q"), 0],
    ["AJRWBVZKQTMPNSE1!", 1],
    ["ajrwbvzkqtmpnse1!", 2],
    ["Ajrwbvzkqtmpnsey!", 3],
    ["Ajrwbvzkqtmpnsey1", 4],
  ])("marks only the unmet requirement for %s", (password, index) => {
    expect(missing(password)).toEqual([PASSWORD_REQUIREMENTS[index]]);
  });

  it.each([
    VALID_PASSWORD,
    "",
    "Aa1!",
    "Ajrwbvzkqtmpns1 😀",
    "Ąjrwbvzkqtmpnsż1!",
    VALID_PASSWORD.padEnd(256, "xy3Q"),
    VALID_PASSWORD.padEnd(257, "xy3Q"),
  ])("agrees with passwordError for %j", (password) => {
    expect(missing(password).length === 0).toBe(
      passwordError(password) === null,
    );
  });
});

// I5: passwords that pass every class but are easy to guess.
describe("passwordError for weak passwords", () => {
  it("rejects one character making up half of the password", () => {
    expect(passwordError("aaaaaaaaaaaaaaaA1!")).toEqual({
      key: "passwordRepetitive",
    });
    expect(passwordError("Ajrwbvzkqtmpnse1!")).toBeNull();
  });

  it.each([
    "Xabcdefq-Lmw9!zzpt",
    "Xfedcbaq-Lmw9!zzpt",
    "Moje-hasło-123456!",
    "Moje-hasło-987654!",
    "Moje-QWERTY-hasło1!",
    "Moje-Asdfgh-hasło1!",
  ])("rejects a simple sequence in %s", (password) => {
    expect(passwordError(password)).toEqual({
      key: "passwordSequence",
      values: { length: 6 },
    });
  });

  it("allows shorter runs", () => {
    expect(passwordError("Correct-horse-12345")).toBeNull();
  });

  it("rejects the nickname in the password, in any case", () => {
    expect(passwordError("Alice-river-Mountain9!", "alice")).toEqual({
      key: "passwordContainsNickname",
    });
    expect(passwordError("Alice-river-Mountain9!", "bob")).toBeNull();
    expect(passwordError("Alice-river-Mountain9!")).toBeNull();
  });
});
