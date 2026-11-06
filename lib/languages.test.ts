import { describe, expect, it } from "vitest";
import {
  folderLanguage,
  languageOfFolder,
  languageToolCode,
} from "./languages";

describe("folderLanguage", () => {
  it("treats a missing or unknown language as Polish", () => {
    expect(folderLanguage(undefined)).toBe("pl");
    expect(folderLanguage(null)).toBe("pl");
    expect(folderLanguage("xx")).toBe("pl");
    expect(folderLanguage("pl")).toBe("pl");
  });
});

describe("languageToolCode", () => {
  it("maps a folder language to LanguageTool's code", () => {
    expect(languageToolCode("pl")).toBe("pl-PL");
  });
});

describe("languageOfFolder", () => {
  it("takes the language of the folder with the typed name, default for a new one", () => {
    const folders = [{ name: "Book", language: "pl" as const }];
    expect(languageOfFolder(folders, " Book ")).toBe("pl");
    expect(languageOfFolder(folders, "New")).toBe("pl");
  });
});
