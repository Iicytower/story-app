import { describe, expect, it } from "vitest";
import { chapterFileName } from "./export";

describe("chapterFileName", () => {
  it("pads the number to the chapter count, at least two digits", () => {
    expect(chapterFileName("Zażółć", 0, 3, "docx")).toBe("01-zazolc.docx");
    expect(chapterFileName("Ten", 99, 100, "pdf")).toBe("100-ten.pdf");
    expect(chapterFileName("One", 0, 100, "pdf")).toBe("001-one.pdf");
  });

  it("falls back when the title has no safe characters", () => {
    expect(chapterFileName("???", 0, 1, "md")).toBe("01-chapter.md");
  });
});
