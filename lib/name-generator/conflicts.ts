import {
  type Filters,
  SINGLE_GROUPS,
  type SingleGroup,
  type Style,
  STYLES,
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
  for (const toggle of Object.keys(TOGGLES) as Toggle[]) {
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
  if (group in TOGGLES) return { ...filters, [group]: false };
  return { ...filters, [group]: "any" };
}

export function selectValue(filters: Filters, key: FilterKey): Filters {
  const cleared = clearedBy(filters, key).reduce(clearValue, filters);
  const [group, value] = key.split(":");
  if (group === "style") {
    return { ...cleared, styles: [...cleared.styles, value as Style] };
  }
  if (group === "polishLetters") return { ...cleared, polishLetters: false };
  if (group in TOGGLES) return { ...cleared, [group]: true };
  return { ...cleared, [group]: value };
}

export function keyLabel(key: FilterKey): string {
  const [group, value] = key.split(":");
  if (group === "style") {
    return STYLES.find((style) => style.value === value)?.label ?? value;
  }
  if (group === "polishLetters") return "No Polish letters";
  if (group in TOGGLES) return TOGGLES[group as Toggle];
  const options: readonly { value: string; label: string }[] =
    SINGLE_GROUPS[group as SingleGroup].options;
  return options.find((option) => option.value === value)?.label ?? value;
}

export function clearsLabel(keys: FilterKey[]): string | undefined {
  return keys.length > 0
    ? `Clears ${keys.map(keyLabel).join(", ")}`
    : undefined;
}
