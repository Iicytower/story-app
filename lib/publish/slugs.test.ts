import { describe, expect, it } from "vitest";
import {
  FOLDER_SLUG_FALLBACK,
  RESERVED_FOLDER_SLUGS,
  slugsById,
} from "./slugs";

describe("slugsById", () => {
  it("transliterates the text and falls back when nothing is left", () => {
    const slugs = slugsById(
      [
        { id: "1", text: "Zażółć Gęślą" },
        { id: "2", text: "???" },
      ],
      "chapter",
    );
    expect(slugs.get("1")).toBe("zazolc-gesla");
    expect(slugs.get("2")).toBe("chapter");
  });

  it("gives the oldest item the plain slug, whatever the input order", () => {
    const slugs = slugsById(
      [
        { id: "2", text: "Ą" },
        { id: "1", text: "A" },
        { id: "3", text: "a-2" },
      ],
      "chapter",
    );
    expect(slugs.get("1")).toBe("a");
    expect(slugs.get("2")).toBe("a-2");
    expect(slugs.get("3")).toBe("a-2-2");
  });
});

describe("reserved folder slugs", () => {
  it("move a folder off the static routes of the profile", () => {
    const slugs = slugsById(
      [
        { id: "1", text: "Followers" },
        { id: "2", text: "following" },
        { id: "3", text: "Forum" },
        { id: "4", text: "followers-2" },
        { id: "5", text: "Forum stories" },
      ],
      FOLDER_SLUG_FALLBACK,
      RESERVED_FOLDER_SLUGS,
    );
    expect([...slugs.values()]).toEqual([
      "followers-2",
      "following-2",
      "forum-2",
      "followers-2-2",
      "forum-stories",
    ]);
  });
});
