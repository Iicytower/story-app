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
      location("/books", { "accept-language": "pl-PL,pl;q=0.9,en;q=0.8" }),
    ).toBe("http://localhost/pl/books");
  });

  it("prefers the cookie over Accept-Language", () => {
    expect(
      location("/books", {
        "accept-language": "pl-PL,pl;q=0.9",
        cookie: "NEXT_LOCALE=en",
      }),
    ).toBe("http://localhost/en/books");
  });

  it("falls back to English", () => {
    expect(location("/books", { "accept-language": "de-DE,de" })).toBe(
      "http://localhost/en/books",
    );
  });

  it("leaves a prefixed path alone", () => {
    expect(location("/en/books")).toBeNull();
  });
});

describe("withLocale", () => {
  it.each([
    ["/en/books?q=a", "pl", "/pl/books?q=a"],
    ["/pl", "en", "/en"],
    ["/en/", "pl", "/pl/"],
    ["/chapters/1", "pl", "/pl/chapters/1"],
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
