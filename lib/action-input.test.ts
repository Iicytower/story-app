import { describe, expect, it } from "vitest";
import {
  isBoolean,
  isFraction,
  isId,
  isIsoDate,
  isString,
} from "./action-input";

const WRONG = [123, [], {}, null, undefined, { $ne: 0 }];

describe("action input guards", () => {
  it("isString and isBoolean accept only their type", () => {
    expect(isString("")).toBe(true);
    expect(isBoolean(false)).toBe(true);
    for (const value of [...WRONG, true]) expect(isString(value)).toBe(false);
    for (const value of [...WRONG, "true", 1]) {
      expect(isBoolean(value)).toBe(false);
    }
  });

  it("isId accepts only a 24-character hex string", () => {
    expect(isId("0123456789abcdef01234567")).toBe(true);
    expect(isId("0123456789abcdef0123456")).toBe(false);
    expect(isId({ _bsontype: "ObjectId", id: "x" })).toBe(false);
    for (const value of WRONG) expect(isId(value)).toBe(false);
  });

  it("isFraction accepts only a number from 0 to 1", () => {
    for (const value of [0, 0.5, 1]) expect(isFraction(value)).toBe(true);
    for (const value of [...WRONG, -0.1, 1.1, NaN, Infinity, "0.5"]) {
      expect(isFraction(value)).toBe(false);
    }
  });

  it("isIsoDate accepts only the ISO string the server sends", () => {
    expect(isIsoDate("2026-01-01T00:00:00.000Z")).toBe(true);
    expect(isIsoDate(new Date(0).toISOString())).toBe(true);
    for (const value of [
      ...WRONG,
      "",
      "not a date",
      "2026-01-01",
      "2026-13-01T00:00:00.000Z",
      0,
    ]) {
      expect(isIsoDate(value)).toBe(false);
    }
  });
});
