import { describe, expect, it } from "vitest";
import { checkRequestBody, issueKind, mapMatches } from "./languagetool";

describe("mapMatches", () => {
  it("maps LanguageTool matches to issues independent of its format", () => {
    const issues = mapMatches({
      software: { name: "LanguageTool" },
      matches: [
        {
          message: "Możliwy błąd pisowni",
          shortMessage: "Pisownia",
          offset: 10,
          length: 4,
          replacements: [{ value: "błąd" }, { value: "blad" }],
          context: { text: "…", offset: 0, length: 4 },
          rule: {
            id: "MORFOLOGIK_RULE_PL_PL",
            issueType: "misspelling",
            category: { id: "TYPOS", name: "Literówki" },
          },
        },
      ],
    });
    expect(issues).toEqual([
      {
        offset: 10,
        length: 4,
        kind: "spelling",
        message: "Możliwy błąd pisowni",
        replacements: ["błąd", "blad"],
        ruleId: "MORFOLOGIK_RULE_PL_PL",
      },
    ]);
  });

  it("keeps a short list of replacements and allows none", () => {
    const [many, none] = mapMatches({
      matches: [
        {
          message: "a",
          offset: 0,
          length: 1,
          replacements: Array.from({ length: 30 }, (_, i) => ({
            value: `w${i}`,
          })),
          rule: { id: "R" },
        },
        { message: "b", offset: 2, length: 1, rule: { id: "PL_WORD_REPEAT" } },
      ],
    });
    expect(many.replacements).toHaveLength(8);
    expect(none.replacements).toEqual([]);
  });

  it("gives no issues for a response without matches", () => {
    expect(mapMatches({ matches: [] })).toEqual([]);
    expect(mapMatches(null)).toEqual([]);
    expect(mapMatches({ matches: {} })).toEqual([]);
    expect(mapMatches({ matches: [{ message: "x" }, null] })).toEqual([]);
  });
});

describe("issueKind", () => {
  it.each([
    [{ category: { id: "TYPOS" } }, "spelling"],
    [{ category: { id: "PUNCTUATION" } }, "punctuation"],
    [{ category: { id: "GRAMMAR" } }, "grammar"],
    [{ category: { id: "REDUNDANCY" } }, "style"],
    [{ issueType: "misspelling" }, "spelling"],
    [{ issueType: "typographical" }, "punctuation"],
    [{ issueType: "style" }, "style"],
    [{ category: { id: "SOMETHING_NEW" }, issueType: "uncategorized" }, "other"],
    [undefined, "other"],
  ] as const)("%j is %s", (rule, kind) => {
    expect(issueKind(rule)).toBe(kind);
  });
});

describe("checkRequestBody", () => {
  it("sends the markdown as annotated data with the folder's language", () => {
    const body = checkRequestBody("Kot **kot**", "pl");
    expect(body.get("language")).toBe("pl-PL");
    expect(body.get("enabledRules")).toBe("PL_WORD_REPEAT");
    expect(body.has("text")).toBe(false);
    expect(body.get("disabledRules")).toBe("BOWIEM_ZAS");
    expect(JSON.parse(body.get("data")!)).toEqual({
      annotation: [
        { text: "Kot " },
        { markup: "**" },
        { text: "kot" },
        { markup: "**" },
      ],
    });
  });
});
