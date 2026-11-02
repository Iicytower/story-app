import type { Mood } from "../filters";

type ByMood = Record<Mood, string[]>;

const lists = (columns: Record<Mood, string>): ByMood =>
  Object.fromEntries(
    Object.entries(columns).map(([mood, words]) => [mood, words.split(" ")]),
  ) as ByMood;

export const EN_FIRST = lists({
  dark: "Black Shadow Grim Dread Ash Night Blood Bone Raven Doom",
  noble: "King Silver Gold High Crown Lion Royal Bright Summer Eagle",
  comic: "Mud Turnip Goose Pickle Muddle Wobble Cabbage Bumble Sausage Soggy",
  ethereal: "Moon Star Mist Dawn Silk Willow Pearl Whisper Dream Glimmer",
  common: "Stone Oak Green Ford Mill Red Long Hill Barley Marsh",
});

export const EN_SECOND: Record<"place" | "thing" | "org", string[]> = {
  place: "fall hold haven reach mere vale gate watch march hollow".split(" "),
  thing: "bane fang song brand heart thorn shard wing breaker tooth".split(" "),
  org: "hand blade shield banner crown flame".split(" "),
};

export const EN_ADJECTIVES = lists({
  dark: "Black Grim Hollow Broken Bleeding Silent Rotten Cold",
  noble: "Silver Golden Gilded Royal Radiant Sacred Crowned Valiant",
  comic: "Drunken Wobbly Grumpy Tipsy Lazy Merry Soggy Hungry",
  ethereal: "Pale Starlit Moonlit Silken Whispering Dreaming Veiled Shining",
  common: "Red Green Old Little Lucky Honest Quiet Rusty",
});

export const EN_NOUNS = lists({
  dark: "Skull Raven Serpent Wolf Shroud Crow Thorn Grave",
  noble: "Sun Lion Stag Rose Eagle Falcon Sword Oath",
  comic: "Goose Pig Herring Turnip Badger Ferret Pickle Duckling",
  ethereal: "Moon Star Veil Swan Lily Dawn Mist Feather",
  common: "Horse Anchor Barrel Hammer Lantern Boar Oak Wheel",
});

export const EN_EPITHETS = lists({
  dark: "Grim Cruel Black Merciless Dread Pale Hollow Accursed Ruthless Faceless",
  noble: "Great Wise Just Bold Valiant Radiant Golden Fair Glorious Exalted",
  comic:
    "Unready Portly Clumsy Tipsy Bewildered Loud Sleepy Toothless Lucky Damp",
  ethereal:
    "Silent Veiled Dreamer Pale Fair Moonlit Unseen Serene Wanderer Gentle",
  common: "Grey Tall Younger Elder Red Short Lame Quiet Stout Miller",
});

export const PL_FIRST = lists({
  dark: "Czarno Mroczno Krwawo Popielno Trupio Wilczo Kruczo Cienio",
  noble: "Złoto Srebrno Król Biało Jasno Wielko Święto Orło",
  comic: "Kapusto Błoto Gąsio Rzepo Gapio Pyzo Bzdurno Kluchowo",
  ethereal: "Mgliste Księżyco Gwiazdo Jedwabno Sino Świetlisto Rosno Tęczo",
  common: "Stara Nowo Dębo Zielono Kamienno Lipno Bystro Grabo",
});

export const PL_SECOND: Record<"place" | "thing", string[]> = {
  place: "gród bór wola góra brzeg dół pole las".split(" "),
  thing: "miecz kieł cień ostrze pieśń serce skrzydło".split(" "),
};

// Declined forms, because they follow words such as "Zakon" and "Karczma".
export const PL_PHRASES = lists({
  dark: "Czarnego|Słońca Krwawej|Pięści Popielnej|Róży Martwego|Kruka Nocnego|Wilka Żelaznej|Czaszki",
  noble:
    "Złotego|Lwa Srebrnej|Róży Białego|Orła Świętego|Płomienia Królewskiego|Miecza Jasnego|Słońca",
  comic:
    "Pijanej|Gęsi Tłustego|Karpia Chromego|Osła Wesołej|Rzepy Głodnego|Borsuka Starej|Kapusty",
  ethereal:
    "Srebrnej|Mgły Bladego|Księżyca Cichej|Gwiazdy Białej|Lilii Nocnej|Rosy Jasnego|Świtu",
  common:
    "Starego|Dębu Zielonego|Pola Czerwonego|Konia Dobrego|Kowala Dzikiego|Wilka Złotego|Kłosa",
});

export const PL_EPITHETS = lists({
  dark: "Krwawy Okrutny Czarny Mroczny Bezlitosny Blady Przeklęty Ponury Straszny Ślepy",
  noble:
    "Wielki Mądry Sprawiedliwy Śmiały Dostojny Złoty Waleczny Prawy Jasny Pobożny",
  comic:
    "Gapowaty Tłusty Niezdarny Pijany Zaspany Łysy Krzywy Bezzębny Roztargniony Rudy",
  ethereal:
    "Milczący Zamyślony Biały Cichy Srebrny Łagodny Blady Senny Nieuchwytny Promienny",
  common: "Szary Wysoki Młody Stary Rudy Niski Kulawy Cichy Krępy Czarny",
});

export const SCIFI_FIRST =
  "Nova Helio Astra Cryo Neo Proto Quantum Vector Xeno Omega Stellar Cyber".split(
    " ",
  );

export const SCIFI_SECOND =
  "prime core gate net dyne forge drive sync vault nexus".split(" ");

export const EPITHET_ENDINGS: Record<"pl" | "en", string[]> = {
  pl: ["ny", "ski", "owy", "aty"],
  en: ["bane", "born", "heart", "hand", "ward"],
};
