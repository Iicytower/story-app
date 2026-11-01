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

export function nicknameError(nickname: string): string | null {
  return NICKNAME_PATTERN.test(nickname)
    ? null
    : "Nickname must be 3-30 characters: letters a-z, digits, _ and -.";
}

export function passwordError(password: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters long.`;
  }
  if (!/\p{Ll}/u.test(password)) {
    return "Password must contain a lowercase letter.";
  }
  if (!/\p{Lu}/u.test(password)) {
    return "Password must contain an uppercase letter.";
  }
  if (!/[0-9]/.test(password)) return "Password must contain a digit.";
  if (!/[!-/:-@[-`{-~]/.test(password)) {
    return "Password must contain an ASCII special character.";
  }
  return null;
}
