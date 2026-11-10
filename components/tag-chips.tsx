"use client";

import { useTranslations } from "next-intl";
import { useTagLabel } from "@/components/predefined-tags";
import { inheritedOnly } from "@/lib/tags/tags";

const CHIP = "rounded-full px-2 py-0.5 text-xs whitespace-nowrap";
export const PREDEFINED_CHIP = "bg-primary/10 text-primary";

export function TagChips({
  tags = [],
  folderTags = [],
}: {
  tags?: string[];
  folderTags?: string[];
}) {
  const t = useTranslations("tags");
  const labelOf = useTagLabel();
  const inherited = inheritedOnly(tags, folderTags);
  if (tags.length + inherited.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => {
        const label = labelOf(tag);
        return (
          <span
            key={tag}
            title={label ? t("predefined") : undefined}
            className={`${CHIP} ${label ? PREDEFINED_CHIP : "bg-muted"}`}
          >
            {label ?? tag}
          </span>
        );
      })}
      {inherited.map((tag) => {
        const label = labelOf(tag);
        return (
          <span
            key={tag}
            title={t("fromFolder")}
            className={`${CHIP} border border-dashed ${label ? "text-primary" : "text-muted-foreground"}`}
          >
            {label ?? tag}
          </span>
        );
      })}
    </span>
  );
}
