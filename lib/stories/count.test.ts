import { describe, expect, it } from "vitest";
import { countCharacters, countWords } from "./count";

describe("countWords", () => {
  it("returns 0 for empty and whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  \n\t ")).toBe(0);
  });

  it("ignores repeated spaces and surrounding whitespace", () => {
    expect(countWords("  one   two    three  ")).toBe(3);
  });

  it("splits on newlines and tabs", () => {
    expect(countWords("one\ntwo\n\nthree\tfour")).toBe(4);
  });

  it("counts words with Polish characters", () => {
    expect(countWords("Zażółć gęślą jaźń")).toBe(3);
  });
});

describe("countCharacters", () => {
  it("returns 0 for empty text", () => {
    expect(countCharacters("")).toBe(0);
  });

  it("counts spaces and newlines", () => {
    expect(countCharacters("a  b\nc")).toBe(6);
  });

  it("counts each Polish character once", () => {
    expect(countCharacters("zażółć")).toBe(6);
  });

  it("counts an emoji as one character", () => {
    expect(countCharacters("a😀")).toBe(2);
  });
});
