// Sources of the dictionary tools and their attribution (tasks 32–34, D62–D64). The tile names
// the sources its results came from, by the `source` label the dictionary service gives each one.

export type SourceId = "wiktionary" | "dobryslownik" | "polimorf" | "wordfreq";

export interface SourceInfo {
  name: string;
  url: string;
  licence: string;
  licenceUrl: string;
  // Copyright lines the licence asks to keep; `dict:build` checks them against the package.
  copyright?: string[];
  // Short name marking each synonym with its sources (task 33).
  short: string;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  wiktionary: {
    name: "Wikisłownik",
    url: "https://pl.wiktionary.org/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    short: "WS",
  },
  dobryslownik: {
    name: "Dobry słownik",
    url: "https://dobryslownik.pl/",
    licence: "LGPL 2.1",
    licenceUrl: "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html",
    copyright: ["2014–2026 Dobry słownik", "2004–2014 Marcin Miłkowski"],
    short: "DS",
  },
  polimorf: {
    name: "PoliMorf",
    url: "https://zil.ipipan.waw.pl/PoliMorf",
    licence: "BSD 2-Clause",
    licenceUrl: "https://opensource.org/license/bsd-2-clause",
    short: "PM",
  },
  // Its data must keep its attribution and licence (D64).
  wordfreq: {
    name: "wordfreq",
    url: "https://github.com/rspeer/wordfreq",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    copyright: ["2022 Robyn Speer"],
    short: "WF",
  },
};

// Wikisłownik's page title: spaces are underscores.
export const wiktionaryUrl = (word: string) =>
  `https://pl.wiktionary.org/wiki/${encodeURIComponent(word.replaceAll(" ", "_"))}`;

// Opened by the user in a new tab; the server fetches nothing from these pages (task 32).
export function externalLinks(
  word: string,
): { id: "wiktionary" | "sjp" | "pwn"; url: string }[] {
  const encoded = encodeURIComponent(word);
  return [
    { id: "wiktionary", url: wiktionaryUrl(word) },
    { id: "sjp", url: `https://sjp.pl/${encoded}` },
    { id: "pwn", url: `https://sjp.pwn.pl/slowniki/${encoded}.html` },
  ];
}
