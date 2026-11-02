export interface Option<T extends string> {
  value: T;
  label: string;
}

const options = <T extends string>(...pairs: [T, string][]): Option<T>[] =>
  pairs.map(([value, label]) => ({ value, label }));

export const TYPE_GROUPS = [
  {
    label: "Characters",
    types: options(
      ["first-name", "First name"],
      ["surname", "Surname"],
      ["full-name", "Full name"],
      ["epithet", "Epithet"],
    ),
  },
  {
    label: "Places",
    types: options(
      ["city", "City"],
      ["village", "Village"],
      ["river", "River"],
      ["mountains", "Mountains"],
      ["forest", "Forest"],
      ["kingdom", "Kingdom"],
      ["inn", "Inn"],
    ),
  },
  {
    label: "Organizations",
    types: options(
      ["guild", "Guild"],
      ["order", "Order"],
      ["house", "House"],
      ["company", "Company"],
      ["faction", "Faction"],
    ),
  },
  {
    label: "Things and beings",
    types: options(
      ["weapon", "Weapon"],
      ["artifact", "Artifact"],
      ["ship", "Ship"],
      ["spell", "Spell"],
      ["species", "Species"],
      ["monster", "Monster"],
      ["deity", "Deity"],
    ),
  },
] as const;

export type NameType = (typeof TYPE_GROUPS)[number]["types"][number]["value"];

export const NAME_TYPES: NameType[] = TYPE_GROUPS.flatMap((group) =>
  group.types.map((type) => type.value),
);

export const STYLES = options(
  ["polish", "Polish/Slavic"],
  ["english", "English"],
  ["german", "German"],
  ["nordic", "Nordic"],
  ["latin", "Latin"],
  ["celtic", "Celtic"],
  ["elvish", "Elvish"],
  ["dwarven", "Dwarven"],
  ["orcish", "Orcish"],
  ["scifi", "Sci-fi"],
);

export type Style = (typeof STYLES)[number]["value"];

export const STYLE_IDS: Style[] = STYLES.map((style) => style.value);

export const SINGLE_GROUPS = {
  gender: {
    label: "Gender",
    options: options(
      ["male", "Male"],
      ["female", "Female"],
      ["neutral", "Neutral"],
    ),
  },
  sound: {
    label: "Sound",
    options: options(
      ["hard", "Hard"],
      ["soft", "Soft"],
      ["neutral", "Neutral"],
    ),
  },
  length: {
    label: "Length",
    options: options(
      ["short", "Short"],
      ["medium", "Medium"],
      ["long", "Long"],
    ),
  },
  pronunciation: {
    label: "Pronunciation",
    options: options(
      ["easy", "Easy"],
      ["exotic", "Exotic"],
      ["unpronounceable", "Unpronounceable"],
    ),
  },
  balance: {
    label: "Letter balance",
    options: options(
      ["vowel-heavy", "Vowel-heavy"],
      ["balanced", "Balanced"],
      ["consonant-heavy", "Consonant-heavy"],
    ),
  },
  mood: {
    label: "Mood",
    options: options(
      ["dark", "Dark"],
      ["noble", "Noble"],
      ["comic", "Comic"],
      ["ethereal", "Ethereal"],
      ["common", "Common"],
    ),
  },
  wordCount: {
    label: "Word count",
    options: options(["one", "One"], ["two", "Two"], ["three", "Three"]),
  },
};

export const CRUDE_OPTIONS = options(
  ["exclude", "Exclude"],
  ["allow", "Allow"],
  ["only", "Only"],
);

export const TOGGLES = {
  mixStyles: "Mix styles",
  alliteration: "Alliteration",
  repeatedSyllable: "Repeated syllable",
  punctuation: "Apostrophes and hyphens",
  easyInflect: "Easy to inflect",
};

export type SingleGroup = keyof typeof SINGLE_GROUPS;
export type Toggle = keyof typeof TOGGLES;
type GroupValue<G extends SingleGroup> =
  (typeof SINGLE_GROUPS)[G]["options"][number]["value"];
export type Mood = GroupValue<"mood">;
export type Crude = (typeof CRUDE_OPTIONS)[number]["value"];

export type Filters = { [G in SingleGroup]: GroupValue<G> | "any" } & {
  [T in Toggle]: boolean;
} & {
  type: NameType;
  styles: Style[];
  crude: Crude;
  polishLetters: boolean;
  startsWith: string;
  endsWith: string;
  contains: string;
  excludes: string;
};

export const DEFAULT_FILTERS: Filters = {
  type: "first-name",
  gender: "any",
  styles: [],
  mixStyles: false,
  sound: "any",
  length: "any",
  pronunciation: "any",
  crude: "exclude",
  balance: "any",
  mood: "any",
  startsWith: "",
  endsWith: "",
  contains: "",
  excludes: "",
  alliteration: false,
  repeatedSyllable: false,
  polishLetters: true,
  punctuation: false,
  wordCount: "any",
  easyInflect: false,
};

export function hasGender(type: NameType): boolean {
  return type === "first-name" || type === "full-name";
}

export function hasWordCount(type: NameType): boolean {
  return type !== "full-name" && type !== "epithet";
}

export function hasAlliteration(type: NameType): boolean {
  return type !== "epithet";
}

// Hidden filters keep their value for later, but must not affect the result.
export function effectiveFilters(filters: Filters): Filters {
  return {
    ...filters,
    gender: hasGender(filters.type) ? filters.gender : "any",
    wordCount:
      filters.type === "full-name"
        ? "two"
        : hasWordCount(filters.type)
          ? filters.wordCount
          : "any",
    alliteration: hasAlliteration(filters.type) && filters.alliteration,
    mixStyles: filters.styles.length !== 1 && filters.mixStyles,
  };
}

const STORAGE_KEY = "name-generator-filters";
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem">;

export function saveFilters(store: Store, filters: Filters, now: number) {
  store.setItem(STORAGE_KEY, JSON.stringify({ savedAt: now, filters }));
}

function isValidFilters(value: unknown): value is Filters {
  if (typeof value !== "object" || value === null) return false;
  const saved = value as Record<string, unknown>;
  const allowed = (key: string, values: readonly string[]) =>
    values.includes(saved[key] as string);
  const values = (list: readonly { value: string }[]) =>
    list.map((option) => option.value);
  return (
    allowed("type", NAME_TYPES) &&
    allowed("crude", values(CRUDE_OPTIONS)) &&
    Object.entries(SINGLE_GROUPS).every(([key, group]) =>
      allowed(key, ["any", ...values(group.options)]),
    ) &&
    [...Object.keys(TOGGLES), "polishLetters"].every(
      (key) => typeof saved[key] === "boolean",
    ) &&
    ["startsWith", "endsWith", "contains", "excludes"].every(
      (key) => typeof saved[key] === "string",
    ) &&
    Array.isArray(saved.styles) &&
    saved.styles.every((style) => STYLE_IDS.includes(style))
  );
}

export function loadFilters(store: Store, now: number): Filters {
  try {
    const saved = JSON.parse(store.getItem(STORAGE_KEY) ?? "null");
    if (now - saved.savedAt <= EXPIRY_MS && isValidFilters(saved.filters)) {
      return saved.filters;
    }
  } catch {
    // Damaged data is treated like no data.
  }
  return DEFAULT_FILTERS;
}
