import type { ErrorMessage } from "@/lib/i18n/messages";

const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

export const PASSWORD_MIN_LENGTH = 17;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_SPECIAL_CHARACTERS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

// Keys of password.requirements; the texts take these values.
export const PASSWORD_REQUIREMENTS = [
  "length",
  "lowercase",
  "uppercase",
  "digit",
  "special",
] as const;

export const PASSWORD_REQUIREMENT_VALUES = {
  min: PASSWORD_MIN_LENGTH,
  max: PASSWORD_MAX_LENGTH,
  characters: PASSWORD_SPECIAL_CHARACTERS,
};

const LOWERCASE = /\p{Ll}/u;
const UPPERCASE = /\p{Lu}/u;
const DIGIT = /[0-9]/;
const SPECIAL = /[!-/:-@[-`{-~]/;

// Same order as PASSWORD_REQUIREMENTS.
const PASSWORD_CHECKS = [
  (password: string) => {
    const length = [...password].length;
    return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
  },
  (password: string) => LOWERCASE.test(password),
  (password: string) => UPPERCASE.test(password),
  (password: string) => DIGIT.test(password),
  (password: string) => SPECIAL.test(password),
];

export function passwordChecklist(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement, index) => ({
    requirement,
    met: PASSWORD_CHECKS[index](password),
  }));
}

export function nicknameError(nickname: string): ErrorMessage | null {
  return NICKNAME_PATTERN.test(nickname)
    ? null
    : { key: "nicknameRequirement" };
}

// Runs the alphabet, digits and keyboard rows contain, forwards and backwards (I5, D75).
const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
].flatMap((row) => [row, [...row].reverse().join("")]);
export const PASSWORD_SEQUENCE_LENGTH = 6;

function hasSequence(password: string): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i + PASSWORD_SEQUENCE_LENGTH <= lower.length; i++) {
    const part = lower.slice(i, i + PASSWORD_SEQUENCE_LENGTH);
    if (SEQUENCES.some((row) => row.includes(part))) return true;
  }
  return false;
}

// One character making up half of the password, e.g. "aaaaaaaaaaaaaaaA1!".
function isRepetitive(password: string): boolean {
  const characters = [...password];
  const counts = new Map<string, number>();
  for (const character of characters) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return Math.max(...counts.values()) * 2 >= characters.length;
}

// nickname: the account's, when known; a password containing it is easy to guess.
export function passwordError(
  password: string,
  nickname?: string,
): ErrorMessage | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return { key: "passwordTooShort", values: { min: PASSWORD_MIN_LENGTH } };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { key: "passwordTooLong", values: { max: PASSWORD_MAX_LENGTH } };
  }
  if (!LOWERCASE.test(password)) return { key: "passwordNoLowercase" };
  if (!UPPERCASE.test(password)) return { key: "passwordNoUppercase" };
  if (!DIGIT.test(password)) return { key: "passwordNoDigit" };
  if (!SPECIAL.test(password)) return { key: "passwordNoSpecial" };
  if (isRepetitive(password)) return { key: "passwordRepetitive" };
  if (hasSequence(password)) {
    return {
      key: "passwordSequence",
      values: { length: PASSWORD_SEQUENCE_LENGTH },
    };
  }
  if (nickname && password.toLowerCase().includes(nickname.toLowerCase())) {
    return { key: "passwordContainsNickname" };
  }
  return null;
}
