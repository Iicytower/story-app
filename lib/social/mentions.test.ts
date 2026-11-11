import { describe, expect, it } from "vitest";
import { extractMentions, MAX_MENTIONS } from "./mention-text";

describe("extractMentions", () => {
  it("finds nicknames after @, once each regardless of case", () => {
    expect(extractMentions("Hi @Erin and @dave_2, also @erin again")).toEqual([
      "Erin",
      "dave_2",
    ]);
  });

  it("keeps the nickname rules of D37", () => {
    expect(extractMentions("@ab @abc @a-b_c")).toEqual(["abc", "a-b_c"]);
    expect(extractMentions(`@${"x".repeat(31)}`)).toEqual([]);
    expect(extractMentions("@Erin, @Dave.")).toEqual(["Erin", "Dave"]);
  });

  it("skips e-mail addresses and paths", () => {
    expect(extractMentions("mail me at erin@example.com")).toEqual([]);
    expect(extractMentions("https://site.test/@Erin")).toEqual([]);
  });

  it("skips inline code and code blocks", () => {
    expect(extractMentions("`@Erin` and ``x @Dave``")).toEqual([]);
    expect(extractMentions("```\n@Erin\n```\nafter @Dave")).toEqual(["Dave"]);
    expect(extractMentions("~~~js\n@Erin\n")).toEqual([]);
    expect(extractMentions("text\n\n    @Erin indented")).toEqual([]);
  });

  it("skips links and autolinks", () => {
    expect(extractMentions("[@Erin](https://x.test) [x](/@Dave)")).toEqual([]);
    expect(extractMentions("<https://x.test/@Erin> [@Dave][ref]")).toEqual([]);
  });

  it("takes at most MAX_MENTIONS different nicknames", () => {
    const body = Array.from({ length: 12 }, (_, i) => `@user${i}`).join(" ");
    const found = extractMentions(body);
    expect(found).toHaveLength(MAX_MENTIONS);
    expect(found[0]).toBe("user0");
    expect(found.at(-1)).toBe("user9");
  });

  it("reads a text full of brackets and backticks in linear time", () => {
    const bodies = [
      `${"[".repeat(5000)} @Erin`,
      `${"`".repeat(2500)} @Erin ${"``".repeat(1250)}`,
      `${"`a".repeat(2500)} @Erin`,
      `${"<".repeat(5000)} @Erin`,
      `${"[x](".repeat(1250)} @Erin`,
      `${"```\n".repeat(1250)}@Erin`,
    ];
    const start = performance.now();
    for (const body of bodies) extractMentions(body);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("returns nothing at once without an @", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });
});
