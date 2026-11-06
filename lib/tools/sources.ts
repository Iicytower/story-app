// Sources of the dictionary tools and their attribution (tasks 32–34, D62). The tile names the
// sources its results came from, by the `source` label the dictionary service gives each one.

export type SourceId = "wiktionary" | "polimorf";

export interface SourceInfo {
  name: string;
  url: string;
  licence: string;
  licenceUrl: string;
  // CC BY-SA asks to say that the text was changed (labels moved out of it, D62).
  changed: boolean;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  wiktionary: {
    name: "Wikisłownik",
    url: "https://pl.wiktionary.org/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    changed: true,
  },
  polimorf: {
    name: "PoliMorf",
    url: "https://zil.ipipan.waw.pl/PoliMorf",
    licence: "BSD 2-Clause",
    licenceUrl: "https://opensource.org/license/bsd-2-clause",
    changed: false,
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
