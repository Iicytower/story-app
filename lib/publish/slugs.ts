import { safeFileName } from "@/lib/stories/export";

export const FOLDER_SLUG_FALLBACK = "folder";
export const CHAPTER_SLUG_FALLBACK = "chapter";
// Static routes next to /p/<nick>/[folder] (D80): a folder with such a name gets "-2".
export const RESERVED_FOLDER_SLUGS = ["followers", "following", "forum"];

// Computed on read, so no unique index can turn a slug collision into a "title exists" error.
// Oldest item first: a later item with the same text cannot change an existing address.
export function slugsById(
  items: { id: string; text: string }[],
  fallback: string,
  reserved: readonly string[] = [],
): Map<string, string> {
  const slugs = new Map<string, string>();
  const used = new Set<string>(reserved);
  for (const { id, text } of items.toSorted((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const base = safeFileName(text, fallback);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    slugs.set(id, slug);
  }
  return slugs;
}
