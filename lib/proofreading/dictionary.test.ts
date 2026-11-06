import { describe, expect, it } from "vitest";
import {
  dictionaryMatcher,
  filterIssues,
  MAX_DICTIONARY_WORDS,
  normalizeDictionary,
  parseDictionaryWord,
} from "./dictionary";
import type { IssueKind, ProofreadIssue } from "./languagetool";

describe("parseDictionaryWord", () => {
  it.each([
    [" Ania ", "Ania"],
    ["o’clock", "o'clock"],
    ["Kóń", "Kóń"],
    ["x".repeat(50), "x".repeat(50)],
    ["Wąż-Strażnik", "Wąż-Strażnik"],
  ])("%j → %j", (value, word) => {
    expect(parseDictionaryWord(value)).toBe(word);
  });

  it.each([["", "   ", "dwa słowa", "a\tb", "x".repeat(51), 3, null, ["a"]]])(
    "rejects %j",
    (...values) => {
      for (const value of values) expect(parseDictionaryWord(value)).toBeNull();
    },
  );
});

describe("normalizeDictionary", () => {
  it("drops invalid entries and duplicates and keeps the limit", () => {
    expect(
      normalizeDictionary(["Ania", " Ania", "a b", 1, "o’", "o'"]),
    ).toEqual(["Ania", "o'"]);
    const many = Array.from({ length: MAX_DICTIONARY_WORDS + 5 }, (_, i) =>
      String(i),
    );
    expect(normalizeDictionary(many)).toHaveLength(MAX_DICTIONARY_WORDS);
    expect(normalizeDictionary("Ania")).toBeUndefined();
  });
});

describe("dictionaryMatcher", () => {
  it("accepts a lower-case word Capitalized and in ALL CAPS", () => {
    const accepts = dictionaryMatcher(["kwantowiec"]);
    expect(["kwantowiec", "Kwantowiec", "KWANTOWIEC"].map(accepts)).toEqual([
      true,
      true,
      true,
    ]);
    expect(["kwantowca", "kWantowiec"].map(accepts)).toEqual([false, false]);
  });

  it("accepts a word with capitals only as written and in ALL CAPS", () => {
    const accepts = dictionaryMatcher(["Ania", "iPhone"]);
    expect(
      ["Ania", "ANIA", "ania", "Ani", "iPhone", "IPHONE", "IPhone"].map(
        accepts,
      ),
    ).toEqual([true, true, false, false, true, true, false]);
  });

  it("handles Polish letters, apostrophes and characters outside the BMP", () => {
    expect(dictionaryMatcher(["żółw"])("Żółw")).toBe(true);
    expect(dictionaryMatcher(["o'clock"])("o’clock")).toBe(true);
    expect(dictionaryMatcher(["𝒶bc"])("𝒶bc")).toBe(true);
    expect(dictionaryMatcher(["żółw"])("Żółw")).toBe(true);
  });
});

describe("filterIssues", () => {
  const issue = (
    markdown: string,
    text: string,
    kind: IssueKind = "spelling",
  ): ProofreadIssue => ({
    offset: markdown.indexOf(text),
    length: text.length,
    kind,
    message: "",
    replacements: [],
    ruleId: "MORFOLOGIK_RULE_PL_PL",
  });

  it("drops only spelling issues of dictionary words", () => {
    const md = "Ania i Kwak poszli. ANIA wróciła, ania nie.";
    const issues = [
      issue(md, "Ania"),
      issue(md, "Kwak"),
      issue(md, "ANIA"),
      issue(md, "ania"),
      { ...issue(md, "Kwak"), kind: "grammar" as const },
    ];
    expect(filterIssues(md, issues, ["Ania", "Kwak"])).toEqual([
      issues[3],
      issues[4],
    ]);
  });

  it("keeps a word split by markdown in the source", () => {
    const md = "To An**ia**.";
    const split = { ...issue(md, "An**ia"), length: "An**ia**".length };
    expect(filterIssues(md, [split], ["Ania"])).toEqual([split]);
  });

  it("returns the issues as they are with an empty dictionary", () => {
    const md = "Ania";
    const issues = [issue(md, "Ania")];
    expect(filterIssues(md, issues, [])).toBe(issues);
  });
});
