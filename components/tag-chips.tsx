import { useTranslations } from "next-intl";
import { inheritedOnly } from "@/lib/tags/tags";

const CHIP = "rounded-full px-2 py-0.5 text-xs whitespace-nowrap";

export function TagChips({
  tags = [],
  folderTags = [],
}: {
  tags?: string[];
  folderTags?: string[];
}) {
  const t = useTranslations("tags");
  const inherited = inheritedOnly(tags, folderTags);
  if (tags.length + inherited.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span key={tag} className={`${CHIP} bg-muted`}>
          {tag}
        </span>
      ))}
      {inherited.map((tag) => (
        <span
          key={tag}
          title={t("fromFolder")}
          className={`${CHIP} text-muted-foreground border border-dashed`}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
