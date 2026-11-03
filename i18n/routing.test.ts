import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";
import { languageAlternates, routing, withLocale } from "./routing";

const intl = createMiddleware(routing);

function location(path: string, headers: Record<string, string> = {}) {
  const response = intl(
    new NextRequest(`http://localhost${path}`, { headers }),
  );
  return response.headers.get("location");
}

describe("locale routing", () => {
  it("prefixes a path without a locale, keeping the path and query", () => {
    expect(location("/p/alice/book?x=1&y=2")).toBe(
      "http://localhost/en/p/alice/book?x=1&y=2",
    );
  });

  it("takes the locale from Accept-Language", () => {
    expect(
      location("/stories", { "accept-language": "pl-PL,pl;q=0.9,en;q=0.8" }),
    ).toBe("http://localhost/pl/stories");
  });

  it("prefers the cookie over Accept-Language", () => {
    expect(
      location("/stories", {
        "accept-language": "pl-PL,pl;q=0.9",
        cookie: "NEXT_LOCALE=en",
      }),
    ).toBe("http://localhost/en/stories");
  });

  it("falls back to English", () => {
    expect(location("/stories", { "accept-language": "de-DE,de" })).toBe(
      "http://localhost/en/stories",
    );
  });

  it("leaves a prefixed path alone", () => {
    expect(location("/en/stories")).toBeNull();
  });
});

describe("withLocale", () => {
  it.each([
    ["/en/stories?q=a", "pl", "/pl/stories?q=a"],
    ["/pl", "en", "/en"],
    ["/en/", "pl", "/pl/"],
    ["/stories/1", "pl", "/pl/stories/1"],
    ["/", "pl", "/pl"],
    ["/en/p/Alice/book", "pl", "/pl/p/Alice/book"],
  ] as const)("%s in %s is %s", (path, locale, expected) => {
    expect(withLocale(path, locale)).toBe(expected);
  });
});

describe("languageAlternates", () => {
  it("links every language and the address without one", () => {
    expect(languageAlternates("https://example.com", "/p/Alice/book")).toEqual({
      languages: {
        en: "https://example.com/en/p/Alice/book",
        pl: "https://example.com/pl/p/Alice/book",
        "x-default": "https://example.com/p/Alice/book",
      },
    });
  });
});
