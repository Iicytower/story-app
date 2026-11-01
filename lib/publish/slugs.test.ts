import { describe, expect, it } from "vitest";
import { slugsById } from "./slugs";

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
