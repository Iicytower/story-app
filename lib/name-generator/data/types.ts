import type { NameType } from "../filters";

// "first", "surname" and "epithet" pick endings by role; "plain" has none.
export type Role =
  "first" | "surname" | "epithet" | "place" | "thing" | "org" | "plain";

interface TypeShape {
  role: Role;
  // {} is the root. The words around it are not part of the name for Length or Word count.
  en: string[];
  pl: string[];
}

const bare = ["{}"];

export const TYPE_SHAPES: Record<NameType, TypeShape> = {
  "first-name": { role: "first", en: bare, pl: bare },
  surname: { role: "surname", en: bare, pl: bare },
  "full-name": { role: "first", en: bare, pl: bare },
  epithet: { role: "epithet", en: ["the {}"], pl: bare },
  city: { role: "place", en: bare, pl: bare },
  village: { role: "place", en: bare, pl: bare },
  river: { role: "plain", en: ["{}", "River {}"], pl: ["{}", "Rzeka {}"] },
  mountains: {
    role: "plain",
    en: ["{} Mountains", "{} Peaks", "the {} Range"],
    pl: ["Góry {}", "Pasmo {}", "{} Szczyty"],
  },
  forest: {
    role: "plain",
    en: ["{} Forest", "{} Wood", "the {} Wilds"],
    pl: ["Puszcza {}", "Las {}", "{} Bory"],
  },
  kingdom: {
    role: "place",
    en: ["{}", "Kingdom of {}", "{} Realm"],
    pl: ["{}", "Królestwo {}", "Księstwo {}"],
  },
  inn: {
    role: "org",
    en: ["The {}", "{} Inn", "{} Tavern"],
    pl: ["Karczma {}", "Gospoda {}", "Zajazd {}"],
  },
  guild: {
    role: "org",
    en: ["Guild of the {}", "{} Guild"],
    pl: ["Gildia {}", "Cech {}"],
  },
  order: {
    role: "org",
    en: ["Order of the {}", "{} Order"],
    pl: ["Zakon {}", "Bractwo {}"],
  },
  house: {
    role: "org",
    en: ["House {}", "House of {}"],
    pl: ["Ród {}", "Dom {}"],
  },
  company: {
    role: "org",
    en: ["The {} Company", "{} Company", "{} Band"],
    pl: ["Kompania {}", "Drużyna {}"],
  },
  faction: {
    role: "org",
    en: ["The {}", "{} Front", "{} Covenant"],
    pl: ["Frakcja {}", "Sojusz {}"],
  },
  weapon: { role: "thing", en: bare, pl: bare },
  artifact: {
    role: "thing",
    en: ["{}", "Crown of {}", "Eye of {}"],
    pl: ["{}", "Korona {}", "Oko {}"],
  },
  ship: { role: "thing", en: ["{}", "The {}"], pl: ["{}", "Okręt {}"] },
  spell: {
    role: "thing",
    en: ["{}", "{} Ward", "Curse of {}"],
    pl: ["{}", "Klątwa {}", "Znak {}"],
  },
  species: { role: "plain", en: bare, pl: bare },
  monster: { role: "thing", en: bare, pl: bare },
  deity: { role: "plain", en: bare, pl: bare },
};

const WORDS_AROUND_ROOT = Object.values(TYPE_SHAPES).flatMap((shape) =>
  [...shape.en, ...shape.pl].flatMap((template) =>
    template
      .split(" ")
      .filter((word) => word !== "{}")
      .map((word) => word.toLowerCase()),
  ),
);

export const STOP_WORDS = new Set(WORDS_AROUND_ROOT);
