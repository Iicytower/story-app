import { useTranslations } from "next-intl";
import { useId } from "react";
import { SOURCES, type SourceId } from "@/lib/tools/sources";

// Attribution under the results of a dictionary tool (tasks 32–34, D62, D63): each source the
// results came from, with its licence, copyright lines and what the tool changed in it (CC BY-SA
// and LGPL ask to say so).
export function ToolSources({
  sources,
  changes = {},
}: {
  sources: SourceId[];
  changes?: Partial<Record<SourceId, string>>;
}) {
  const t = useTranslations("tools.sources");
  const id = useId();
  if (sources.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="text-muted-foreground border-t pt-2 text-xs"
    >
      <h3 id={id} className="font-medium">
        {t("title")}
      </h3>
      <ul className="grid gap-1">
        {sources.map((source) => {
          const info = SOURCES[source];
          return (
            <li key={source}>
              <a
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {info.name}
              </a>
              ,{" "}
              <a
                href={info.licenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {info.licence}
              </a>
              {info.copyright?.map((line) => (
                <span key={line}>. © {line}</span>
              ))}
              {changes[source] && <>. {changes[source]}</>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
