"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useTagLabel } from "@/components/predefined-tags";
import { tagFilterHref } from "@/lib/tags/tags";

// Predefined tags in their own group (D79), sorted by the label shown.
export function TagFilter({
  tags,
  selected,
  query,
  path,
  label,
  prefetch,
}: {
  tags: string[];
  selected: string[];
  query: string;
  path: string;
  // aria-label of the own tags.
  label: string;
  prefetch?: boolean;
}) {
  const t = useTranslations("tags");
  const labelOf = useTagLabel();
  // A selected tag that no longer exists stays visible, so it can be turned off.
  const all = [...new Set([...tags, ...selected])];
  const predefined = all
    .flatMap((tag) => {
      const text = labelOf(tag);
      return text ? [{ tag, text }] : [];
    })
    .toSorted((a, b) => a.text.localeCompare(b.text));
  const own = all
    .filter((tag) => labelOf(tag) === null)
    .map((tag) => ({ tag, text: tag }));

  const group = (name: string, items: { tag: string; text: string }[]) =>
    items.length > 0 && (
      <nav aria-label={name} className="flex flex-wrap gap-1">
        {items.map(({ tag, text }) => {
          const active = selected.includes(tag);
          return (
            <Link
              key={tag}
              prefetch={prefetch}
              href={tagFilterHref(query, selected, tag, path)}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-2 py-0.5 text-xs ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              }`}
            >
              {text}
            </Link>
          );
        })}
      </nav>
    );

  if (all.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {group(t("filterByCategory"), predefined)}
      {group(label, own)}
    </div>
  );
}
