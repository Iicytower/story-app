"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RhymeGroup, Rhymes as Found } from "@/lib/tools/rhymes";
import { lookUpRhymes } from "./dictionary-actions";
import { createLookupStore, LookupTool } from "./lookup-tool";
import { ToolSources } from "./tool-sources";

const store = createLookupStore<Found>();

function Words({ words, lang }: { words: string[]; lang: string }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-sm">
      {words.map((word) => (
        <li
          key={word}
          lang={lang}
          className="bg-muted/50 rounded px-1.5 py-0.5"
        >
          {word}
        </li>
      ))}
    </ul>
  );
}

function Group({ group, lang }: { group: RhymeGroup; lang: string }) {
  const t = useTranslations("rhymes");
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} className="font-medium">
        {t(`levels.${group.level}`)}
      </h3>
      {group.words.length > 0 ? (
        <Words words={group.words} lang={lang} />
      ) : (
        !expanded && (
          <p className="text-muted-foreground text-sm">{t("onlyMore")}</p>
        )
      )}
      {expanded && <Words words={group.more} lang={lang} />}
      {group.more.length > 0 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="justify-self-start px-0"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t("showLess")
            : t("showMore", { count: group.more.length })}
        </Button>
      )}
    </section>
  );
}

export function Rhymes() {
  const t = useTranslations("rhymes");
  const tSources = useTranslations("tools.sources");
  return (
    <LookupTool
      store={store}
      lookUp={lookUpRhymes}
      isEmpty={(found) => found.groups.length === 0}
      notFound={(word) => t("notFound", { word })}
      resultsLabel={(word) => t("results", { word })}
      renderFound={(found, word, lang) =>
        found.groups.map((group) => (
          // A new result starts collapsed.
          <Group key={`${word} ${group.level}`} group={group} lang={lang} />
        ))
      }
      footer={(result) =>
        result.ok && (
          <ToolSources
            sources={result.found.sources}
            changes={{
              polimorf: tSources("changedRhymeForms"),
              wordfreq: tSources("changedRhymes"),
            }}
          />
        )
      }
    />
  );
}
