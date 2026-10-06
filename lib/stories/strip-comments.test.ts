import { describe, expect, it } from "vitest";
import { stripComments } from "./strip-comments";

describe("stripComments", () => {
  it("leaves text without comments unchanged", () => {
    const text = "# Title\n\nSome *text* with <b>html</b> and -- dashes ->";
    expect(stripComments(text)).toBe(text);
  });

  it("removes inline and multi-line comments", () => {
    expect(stripComments("a <!-- one --> b <!--\ntwo\nlines\n--> c")).toBe(
      "a  b  c",
    );
  });

  it("drops everything after an unclosed comment", () => {
    expect(stripComments("visible <!-- hidden\nmore hidden")).toBe("visible ");
  });

  it("ends a nested comment at the first closing marker", () => {
    expect(stripComments("a <!-- x <!-- y --> z --> b")).toBe("a  z --> b");
  });

  it("removes comments glued together by an earlier removal", () => {
    expect(stripComments("<!-<!-- -->- x -->")).toBe("");
    expect(stripComments("a <!<!-- -->-- secret --> b")).toBe("a  b");
  });

  it("drops a glued comment that stays unclosed", () => {
    expect(stripComments("a <!<!-- x -->-- secret")).toBe("a ");
  });
});
