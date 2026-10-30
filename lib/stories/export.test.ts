import { describe, expect, it } from "vitest";
import { safeFileName } from "./export";

describe("safeFileName", () => {
  it("transliterates Polish characters", () => {
    expect(safeFileName("Zażółć gęślą jaźń", "story")).toBe(
      "zazolc-gesla-jazn",
    );
    expect(safeFileName("ŁĄKA ŚĆŻŹŃÓĘ", "story")).toBe("laka-sczznoe");
  });

  it("strips other diacritics", () => {
    expect(safeFileName("Café Müller", "story")).toBe("cafe-muller");
  });

  it("replaces special characters with single dashes", () => {
    expect(safeFileName(`  A/B\\C: "D"? <E>*|  `, "story")).toBe("a-b-c-d-e");
    expect(safeFileName("../../etc/passwd", "story")).toBe("etc-passwd");
  });

  it("falls back when nothing safe is left", () => {
    expect(safeFileName("?!*", "story")).toBe("story");
    expect(safeFileName("日本語", "story")).toBe("story");
  });

  it("limits the length", () => {
    const name = safeFileName("a".repeat(99) + " " + "b".repeat(50), "story");
    expect(name).toBe("a".repeat(99));
  });
});
