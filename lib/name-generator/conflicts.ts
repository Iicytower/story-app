import {
  type Filters,
  SINGLE_GROUPS,
  type SingleGroup,
  type Style,
  type Toggle,
  TOGGLES,
} from "./filters";

// "sound:hard", "style:elvish", "alliteration:on", "polishLetters:off".
export type FilterKey = string;

export const CONFLICTS: [FilterKey, FilterKey][] = [
  ["pronunciation:easy", "balance:consonant-heavy"],
  ["pronunciation:unpronounceable", "balance:vowel-heavy"],
  ["pronunciation:unpronounceable", "balance:balanced"],
  ["pronunciation:unpronounceable", "repeatedSyllable:on"],
  ["sound:hard", "style:elvish"],
  ["sound:hard", "mood:ethereal"],
  ["sound:soft", "style:orcish"],
  ["sound:soft", "style:dwarven"],
  ["mood:ethereal", "balance:consonant-heavy"],
  ["alliteration:on", "wordCount:one"],
];

export function selectedKeys(filters: Filters): FilterKey[] {
  const keys = filters.styles.map((style) => `style:${style}`);
  for (const group of Object.keys(SINGLE_GROUPS) as SingleGroup[]) {
    if (filters[group] !== "any") keys.push(`${group}:${filters[group]}`);
  }
  for (const toggle of TOGGLES) {
    if (filters[toggle]) keys.push(`${toggle}:on`);
  }
  if (!filters.polishLetters) keys.push("polishLetters:off");
  return keys;
}

function conflictsOf(key: FilterKey): FilterKey[] {
  return CONFLICTS.flatMap(([a, b]) =>
    a === key ? [b] : b === key ? [a] : [],
  );
}

export function clearedBy(filters: Filters, key: FilterKey): FilterKey[] {
  const selected = selectedKeys(filters);
  return conflictsOf(key).filter((other) => selected.includes(other));
}

export function clearValue(filters: Filters, key: FilterKey): Filters {
  const [group, value] = key.split(":");
  if (group === "style") {
    return {
      ...filters,
      styles: filters.styles.filter((style) => style !== value),
    };
  }
  if (group === "polishLetters") return { ...filters, polishLetters: true };
  if (isToggle(group)) return { ...filters, [group]: false };
  return { ...filters, [group]: "any" };
}

export function selectValue(filters: Filters, key: FilterKey): Filters {
  const cleared = clearedBy(filters, key).reduce(clearValue, filters);
  const [group, value] = key.split(":");
  if (group === "style") {
    return { ...cleared, styles: [...cleared.styles, value as Style] };
  }
  if (group === "polishLetters") return { ...cleared, polishLetters: false };
  if (isToggle(group)) return { ...cleared, [group]: true };
  return { ...cleared, [group]: value };
}

// Path of the value's label in the nameGenerator dictionary.
export function labelKey(key: FilterKey): string {
  const [group, value] = key.split(":");
  if (group === "style") return `styles.${value}`;
  if (group === "polishLetters") return "noPolishLetters";
  if (isToggle(group)) return `toggles.${group}`;
  return `groups.${group}.options.${value}`;
}

function isToggle(group: string): group is Toggle {
  return (TOGGLES as readonly string[]).includes(group);
}
