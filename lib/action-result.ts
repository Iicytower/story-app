export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_TITLE"
  | "EMPTY_TITLE"
  | "EMPTY_CONTENT";

export type ActionError = { ok: false; error: ErrorCode; message: string };

export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | ActionError;
