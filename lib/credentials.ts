const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

export const PASSWORD_MIN_LENGTH = 17;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_SPECIAL_CHARACTERS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

export const PASSWORD_REQUIREMENTS = [
  `${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
  "A lowercase letter (any alphabet)",
  "An uppercase letter (any alphabet)",
  "A digit (0-9)",
  `A special character, one of: ${PASSWORD_SPECIAL_CHARACTERS}`,
];

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

export const NICKNAME_REQUIREMENT =
  "Nickname must be 3-30 characters: letters a-z, digits, _ and -.";

export function nicknameError(nickname: string): string | null {
  return NICKNAME_PATTERN.test(nickname) ? null : NICKNAME_REQUIREMENT;
}

export function passwordError(password: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters long.`;
  }
  if (!LOWERCASE.test(password)) {
    return "Password must contain a lowercase letter.";
  }
  if (!UPPERCASE.test(password)) {
    return "Password must contain an uppercase letter.";
  }
  if (!DIGIT.test(password)) return "Password must contain a digit.";
  if (!SPECIAL.test(password)) {
    return "Password must contain an ASCII special character.";
  }
  return null;
}
