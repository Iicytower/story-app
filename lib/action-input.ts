import { isObjectIdOrHexString } from "mongoose";

// Server Actions take their arguments from the request body, so TypeScript types are not a guarantee (F7).

export const isString = (value: unknown): value is string =>
  typeof value === "string";

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

// Only a string: a plain object with _bsontype would pass isObjectIdOrHexString.
export const isId = (value: unknown): value is string =>
  isString(value) && isObjectIdOrHexString(value);

// Timestamps the client got from the server and sends back for the conflict check.
export function isIsoDate(value: unknown): value is string {
  if (!isString(value)) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
