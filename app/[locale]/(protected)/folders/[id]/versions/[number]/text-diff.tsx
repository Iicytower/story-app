import type { DiffPart } from "@/lib/versions/versions";
import { useTranslations } from "next-intl";

export function TextDiff({ parts }: { parts: DiffPart[] | null }) {
  const t = useTranslations("versions");
  if (!parts) {
    return (
      <p className="text-muted-foreground text-sm">{t("tooManyChanges")}</p>
    );
  }
  return (
    <div className="bg-muted/30 rounded-md border p-3 font-mono text-sm break-words whitespace-pre-wrap">
      {parts.map((part, index) =>
        part.added ? (
          <ins
            key={index}
            className="bg-green-500/20 text-green-900 no-underline dark:text-green-200"
          >
            {part.value}
          </ins>
        ) : part.removed ? (
          <del
            key={index}
            className="bg-red-500/20 text-red-900 dark:text-red-200"
          >
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </div>
  );
}
