import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";

const t = createTranslator({ locale: "en", messages: en });

function leaves(tree: object, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

describe("en messages", () => {
  it.each(leaves(en))("%s is valid ICU", (key, message) => {
    const values: Record<string, unknown> = {};
    for (const [, name] of message.matchAll(/\{(\w+)/g)) values[name] = 1;
    for (const [, tag] of message.matchAll(/<(\w+)>/g)) {
      values[tag] = (chunks: string) => chunks;
    }
    const errors: unknown[] = [];
    createTranslator({
      locale: "en",
      messages: en,
      onError: (error) => errors.push(error),
    }).markup(key as never, values as never);
    expect(errors).toEqual([]);
  });

  it("uses ICU plurals", () => {
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
});
