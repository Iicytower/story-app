import type { ErrorMessage } from "@/lib/i18n/messages";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_TITLE"
  | "DUPLICATE_NAME"
  | "EMPTY_NAME"
  | "EMPTY_TITLE"
  | "EMPTY_CONTENT"
  | "INVALID_INPUT"
  | "TOO_LARGE"
  | "ADULT_LOCKED"
  | "RATE_LIMITED"
  | "TOOL_UNAVAILABLE"
  | "TIMEOUT";

export type ActionError = { ok: false; error: ErrorCode; message: string };

export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | ActionError;

// From lib/ validation, which stays free of next-intl: the action translates it with translateError.
export type ValidationError = { ok: false; error: ErrorCode } & ErrorMessage;
