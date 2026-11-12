import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

const MESSAGES = { en, pl };

function leaves(tree: object, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

describe.each(Object.entries(MESSAGES))("%s messages", (locale, messages) => {
  const lang = locale as keyof typeof MESSAGES;
  it("have exactly the keys of en", () => {
    expect(leaves(messages).map(([key]) => key)).toEqual(
      leaves(en).map(([key]) => key),
    );
  });

  it.each(leaves(messages))("%s is valid ICU", (key, message) => {
    const values: Record<string, unknown> = {};
    for (const [, name] of message.matchAll(/\{(\w+)/g)) values[name] = 1;
    for (const [, tag] of message.matchAll(/<(\w+)>/g)) {
      values[tag] = (chunks: string) => chunks;
    }
    const errors: unknown[] = [];
    createTranslator({
      locale: lang,
      messages,
      onError: (error) => errors.push(error),
    }).markup(key as never, values as never);
    expect(errors).toEqual([]);
  });
});

describe("plurals", () => {
  it("has English singular and plural", () => {
    const t = createTranslator({ locale: "en", messages: en });
    expect(t("folders.chapterCount", { count: 1 })).toBe("1 chapter");
    expect(t("folders.chapterCount", { count: 2 })).toBe("2 chapters");
    expect(t("folders.chapterCount", { count: 0 })).toBe("0 chapters");
    expect(t("editor.stats", { words: 1, characters: 3, minutes: 1 })).toBe(
      "1 word · 3 characters · 1 minute read aloud",
    );
    expect(t("nameGenerator.fewMatch", { count: 1 })).toBe(
      "Only 1 name matches these filters.",
    );
    expect(t("nameGenerator.fewMatch", { count: 3 })).toBe(
      "Only 3 names match these filters.",
    );
  });

  it.each([
    [1, "1 rozdział"],
    [2, "2 rozdziały"],
    [4, "4 rozdziały"],
    [5, "5 rozdziałów"],
    [12, "12 rozdziałów"],
    [22, "22 rozdziały"],
    [25, "25 rozdziałów"],
    [0, "0 rozdziałów"],
  ])("has the Polish form for %i", (count, expected) => {
    const t = createTranslator({ locale: "pl", messages: pl });
    expect(t("folders.chapterCount", { count })).toBe(expected);
  });

  it("uses Polish forms in sentences", () => {
    const t = createTranslator({ locale: "pl", messages: pl });
    expect(t("editor.stats", { words: 3, characters: 18, minutes: 1 })).toBe(
      "3 słowa · 18 znaków · 1 minuta czytania na głos",
    );
    expect(t("versions.willReturn", { count: 5 })).toBe("5 rozdziałów wróci.");
  });
});

describe("naming (D83)", () => {
  // The public search keeps "opowiadania" for published works (D83).
  const ALLOWED = new Set(["search.title", "search.label", "search.none"]);

  // Arguments ({folder}) and select keys (folder {…}) are code, not UI text.
  const text = (message: string) =>
    message
      .replace(/([,}])\s*=?\w+\s*(?=\{)/g, "$1")
      .replace(/\{\s*\w+\s*\}/g, "");

  it.each(Object.entries(MESSAGES))(
    "%s calls the container a book",
    (_, messages) => {
      const offending = leaves(messages).filter(
        ([key, message]) =>
          !ALLOWED.has(key) && /folder|opowiadani/i.test(text(message)),
      );
      expect(offending).toEqual([]);
    },
  );
});
