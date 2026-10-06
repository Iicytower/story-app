import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { serialize } from "@/lib/serialize";

describe("serialize", () => {
  it("maps _id to string id, dates to ISO strings and drops __v", () => {
    const _id = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const createdAt = new Date("2026-01-02T03:04:05.678Z");

    const result = serialize({
      _id,
      __v: 0,
      userId,
      title: "Title",
      createdAt,
      deletedAt: null,
    });

    expect(result).toEqual({
      id: _id.toString(),
      userId: userId.toString(),
      title: "Title",
      createdAt: "2026-01-02T03:04:05.678Z",
      deletedAt: null,
    });
  });
});
