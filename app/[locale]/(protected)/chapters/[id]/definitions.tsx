"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type {
  DefinitionGroup,
  Definitions as Found,
  Sense,
} from "@/lib/tools/definitions";
import { externalLinks, SOURCES, wiktionaryUrl } from "@/lib/tools/sources";
import { lookUpDefinitions } from "./dictionary-actions";
import { createLookupStore, LookupTool, NewTabLink } from "./lookup-tool";
import { ToolSources } from "./tool-sources";

const store = createLookupStore<Found>();

function SenseItem({ sense }: { sense: Sense }) {
  const tLabels = useTranslations("tools.labels");
  const tLookup = useTranslations("lookup");
  return (
    <li className="grid gap-0.5">
      <p>
        <span className="text-muted-foreground mr-1 tabular-nums">
          {sense.index}
        </span>
        {sense.labels.map((label) => (
          <span
            key={label}
            className="bg-muted mr-1 rounded px-1.5 py-0.5 text-xs"
          >
            {sense.region && (label === "dialectal" || label === "regional")
              ? tLookup("label", {
                  label: tLabels(label),
                  region: sense.region,
                })
              : tLabels(label)}
          </span>
        ))}
        {sense.gloss}
      </p>
      {sense.examples.map((example, index) => (
        <p key={index} className="text-muted-foreground pl-4 italic">
          {example}
        </p>
      ))}
    </li>
  );
}

function Group({
  word,
  group,
  lang,
}: {
  word: string;
  group: DefinitionGroup;
  lang: string;
}) {
  const t = useTranslations("definitions");
  const id = useId();
  // Codes without a label of their own show Wikisłownik's Polish name.
  const pos = (entry: DefinitionGroup["entries"][number]) => {
    const key = `pos.${entry.pos}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : entry.posTitle;
  };
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} lang={lang} className="font-medium">
        {group.headword === word
          ? group.headword
          : t("shownFor", { headword: group.headword })}
      </h3>
      {group.entries.map((entry, index) => (
        <div key={index} className="grid gap-1">
          <p className="text-muted-foreground text-xs">{pos(entry)}</p>
          <ol lang={lang} className="grid gap-1.5 text-sm">
            {entry.senses.map((sense, senseIndex) => (
              <SenseItem key={senseIndex} sense={sense} />
            ))}
          </ol>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        <NewTabLink href={wiktionaryUrl(group.headword)}>
          {SOURCES.wiktionary.name}
        </NewTabLink>
        , {SOURCES.wiktionary.licence}
      </p>
    </section>
  );
}

export function Definitions() {
  const t = useTranslations("definitions");
  const tSources = useTranslations("tools.sources");
  return (
    <LookupTool
      store={store}
      lookUp={lookUpDefinitions}
      isEmpty={(found) => found.groups.length === 0}
      notFound={(word) => t("notFound", { word })}
      resultsLabel={(word) => t("results", { word })}
      renderFound={(found, word, lang) =>
        found.groups.map((group) => (
          <Group key={group.headword} word={word} group={group} lang={lang} />
        ))
      }
      footer={(result) => (
        <>
          <p className="flex flex-wrap gap-x-3 text-sm">
            {t("lookElsewhere", { word: result.word })}
            {externalLinks(result.word).map(({ id, url }) => (
              <NewTabLink key={id} href={url}>
                {t(`external.${id}`)}
              </NewTabLink>
            ))}
          </p>
          {result.ok && (
            <ToolSources
              sources={result.found.sources}
              changes={{ wiktionary: tSources("changedDefinitions") }}
            />
          )}
        </>
      )}
    />
  );
}
