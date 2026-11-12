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
            className="bg-diff-added text-diff-added-foreground no-underline"
          >
            {part.value}
          </ins>
        ) : part.removed ? (
          <del
            key={index}
            className="bg-diff-removed text-diff-removed-foreground"
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
