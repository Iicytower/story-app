import type { ActionError } from "@/lib/action-result";

export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS = 10;

function invalid(message: string): ActionError {
  return { ok: false, error: "INVALID_INPUT", message };
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAll(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

// Tags come from the client, so nothing here can be taken on trust.
export function normalizeTags(
  input: unknown,
): { ok: true; tags: string[] } | ActionError {
  if (!Array.isArray(input) || !input.every((tag) => typeof tag === "string")) {
    return invalid("These tags are not valid.");
  }
  const tags = normalizeAll(input);
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return invalid(`A tag can have at most ${MAX_TAG_LENGTH} characters.`);
  }
  if (tags.length > MAX_TAGS) {
    return invalid(`You can use at most ${MAX_TAGS} tags.`);
  }
  return { ok: true, tags };
}

export function splitTagInput(text: string): string[] {
  return normalizeAll(text.split(","));
}

export function parseTagFilter(value: string | string[] | undefined): string[] {
  return normalizeAll(value === undefined ? [] : [value].flat());
}

// Folder tags the chapter does not also have itself.
export function inheritedOnly(
  own: string[] = [],
  folderTags: string[] = [],
): string[] {
  return folderTags.filter((tag) => !own.includes(tag));
}

export function exceedsTagLimit(
  own: string[] = [],
  folderTags: string[] = [],
): boolean {
  return own.length + inheritedOnly(own, folderTags).length > MAX_TAGS;
}

export const TAG_LIMIT_MESSAGE = `A chapter can have at most ${MAX_TAGS} tags, counting the ones from its folder.`;

export function tagFilterHref(
  query: string,
  selected: string[],
  tag: string,
  path = "/stories",
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const tags = selected.includes(tag)
    ? selected.filter((other) => other !== tag)
    : [...selected, tag];
  for (const value of tags) params.append("tag", value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
