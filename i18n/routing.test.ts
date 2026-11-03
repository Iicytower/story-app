import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";
import { routing } from "./routing";

// "pl" arrives in task 45; a second locale is needed to see which source wins.
const intl = createMiddleware({ ...routing, locales: ["en", "pl"] });

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
