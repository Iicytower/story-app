import { useTranslations } from "next-intl";
import { useId } from "react";
import { SOURCES, type SourceId } from "@/lib/tools/sources";

// Attribution under the results of a dictionary tool (tasks 32–34, D62): each source the
// results came from, with its licence.
export function ToolSources({ sources }: { sources: SourceId[] }) {
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
      <ul>
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
              {info.changed && <>. {t("changed")}</>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
