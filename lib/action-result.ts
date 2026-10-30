export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_TITLE"
  | "DUPLICATE_NAME"
  | "EMPTY_NAME"
  | "EMPTY_TITLE"
  | "EMPTY_CONTENT"
  | "INVALID_INPUT"
  | "TOO_LARGE";

export type ActionError = { ok: false; error: ErrorCode; message: string };

export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | ActionError;
