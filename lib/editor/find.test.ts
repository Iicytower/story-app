import { describe, expect, it } from "vitest";
import {
  compileFind,
  expandMatch,
  findMatches,
  type FindOptions,
  nearestMatch,
  replacementTemplate,
  replaceMatches,
} from "./find";

const options = (query: string, rest: Partial<FindOptions> = {}) => ({
  query,
  matchCase: false,
  wholeWord: false,
  regex: false,
  ...rest,
});

function find(text: string, findOptions: FindOptions) {
  const regex = compileFind(findOptions);
  if (!(regex instanceof RegExp)) throw new Error("no pattern");
  return findMatches(text, regex).map(({ from, to }) => text.slice(from, to));
}

function replaceAll(
  text: string,
  findOptions: FindOptions,
  replacement: string,
) {
  const regex = compileFind(findOptions) as RegExp;
  return replaceMatches(
    text,
    findMatches(text, regex),
    regex,
    replacementTemplate(findOptions, replacement),
  );
}

describe("compileFind", () => {
  it("has no pattern for an empty query", () => {
    expect(compileFind(options(""))).toBeNull();
  });

  it("reports an invalid regex", () => {
    expect(compileFind(options("(", { regex: true }))).toBe("invalid");
  });

  it("treats regex characters literally outside regex mode", () => {
    expect(compileFind(options("("))).toBeInstanceOf(RegExp);
    expect(find("a.b axb", options("a.b"))).toEqual(["a.b"]);
  });
});

describe("findMatches", () => {
  it("ignores case by default, also for Polish letters", () => {
    expect(find("Łódź łódź ŁÓDŹ", options("łódź"))).toEqual([
      "Łódź",
      "łódź",
      "ŁÓDŹ",
    ]);
  });

  it("respects match case", () => {
    expect(find("Kot kot", options("kot", { matchCase: true }))).toEqual([
      "kot",
    ]);
  });

  it("finds whole words with Polish letters at the edges", () => {
    const whole = options("kot", { wholeWord: true });
    expect(find("kot kotą ąkot kot_ kot.", whole)).toEqual(["kot", "kot"]);
  });

  it("combines whole word with a regex alternative", () => {
    const whole = options("a|b", { wholeWord: true, regex: true });
    expect(find("a ab b", whole)).toEqual(["a", "b"]);
  });

  it("skips empty matches", () => {
    expect(find("baab", options("a*", { regex: true }))).toEqual(["aa"]);
  });

  it("anchors a regex to lines", () => {
    expect(find("a\na", options("^a$", { regex: true }))).toEqual(["a", "a"]);
  });
});

describe("nearestMatch", () => {
  const matches = [
    { from: 2, to: 3 },
    { from: 6, to: 7 },
  ];

  it("picks the first match from the caret on", () => {
    expect(nearestMatch(matches, 3)).toBe(1);
    expect(nearestMatch(matches, 2)).toBe(0);
  });

  it("wraps past the last match", () => {
    expect(nearestMatch(matches, 7)).toBe(0);
  });
});

describe("replacement", () => {
  it("replaces every match", () => {
    expect(replaceAll("kot, Kot, pies", options("kot"), "pies")).toBe(
      "pies, pies, pies",
    );
  });

  it("removes matches with an empty replacement", () => {
    expect(replaceAll("a-b-c", options("-"), "")).toBe("abc");
  });

  it("inserts $ literally outside regex mode", () => {
    expect(replaceAll("cena", options("cena"), "$1 $& $$")).toBe("$1 $& $$");
  });

  it("expands groups in regex mode", () => {
    expect(
      replaceAll(
        "Jan Kowalski",
        options("(\\w+) (\\w+)", { regex: true }),
        "$2 $1",
      ),
    ).toBe("Kowalski Jan");
  });

  it("keeps lookaround context when expanding a single match", () => {
    const text = "xa ya";
    const regex = compileFind(options("(?<=y)a", { regex: true })) as RegExp;
    const [match] = findMatches(text, regex);
    expect(expandMatch(text, match, regex, "[$&]")).toBe("[a]");
  });
});
