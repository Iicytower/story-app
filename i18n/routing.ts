import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_COOKIE_OPTIONS = {
  maxAge: LOCALE_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax",
} as const;

// A new language: messages/xx.json, an entry here and in LOCALE_NAMES, and its
// document headings in lib/i18n/english.ts (D48).
export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "en",
  localePrefix: "always",
  // The last choice outlives the browser session (D46).
  localeCookie: { maxAge: LOCALE_COOKIE_MAX_AGE },
});

export type Locale = (typeof routing.locales)[number];

// Each language in itself, as the switcher shows it.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

// The same path and query in another language; a path without a locale gets one.
export function withLocale(path: string, locale: Locale): string {
  const url = new URL(path, "http://localhost");
  const [, first, ...rest] = url.pathname.split("/");
  const segments = hasLocale(routing.locales, first)
    ? rest
    : [first, ...rest].filter(Boolean);
  return `/${[locale, ...segments].join("/")}${url.search}`;
}

// hreflang links of a public page; x-default is the address without a locale, which
// sends each visitor to their own language (D47).
export function languageAlternates(origin: string, path: string) {
  return {
    languages: {
      ...Object.fromEntries(
        routing.locales.map((locale) => [
          locale,
          origin + withLocale(path, locale),
        ]),
      ),
      "x-default": origin + path,
    },
  };
}
