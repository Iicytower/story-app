import { describe, expect, it } from "vitest";
import { newChapterIds } from "./new-chapters";

const ADDED = new Date(Date.UTC(2026, 0, 10));
const before = new Date(Date.UTC(2026, 0, 9));
const after = new Date(Date.UTC(2026, 0, 11));

describe("newChapterIds", () => {
  it("counts chapters published after the book was added", () => {
    expect(
      newChapterIds(
        [
          { id: "old", publishedAt: before },
          { id: "same", publishedAt: ADDED },
          { id: "new", publishedAt: after },
        ],
        ADDED,
        [],
      ),
    ).toEqual(["new"]);
  });

  it("leaves out read chapters and those never published", () => {
    expect(
      newChapterIds(
        [
          { id: "read", publishedAt: after },
          { id: "unread", publishedAt: after },
          { id: "never" },
          { id: "null", publishedAt: null },
        ],
        ADDED,
        ["read"],
      ),
    ).toEqual(["unread"]);
  });

  it("has nothing new in an empty book", () => {
    expect(newChapterIds([], ADDED, ["x"])).toEqual([]);
  });
});
