import { Types } from "mongoose";

type SerializedValue<V> = V extends Date
  ? string
  : V extends Types.ObjectId
    ? string
    : V;

export type Serialized<T> = { id: string } & {
  [K in keyof T as K extends "_id" | "__v" ? never : K]: SerializedValue<T[K]>;
};

export function serialize<T extends { _id: Types.ObjectId }>(
  doc: T,
): Serialized<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "__v") continue;
    const outKey = key === "_id" ? "id" : key;
    if (value instanceof Date) result[outKey] = value.toISOString();
    else if (value instanceof Types.ObjectId) result[outKey] = value.toString();
    else result[outKey] = value;
  }
  return result as Serialized<T>;
}
