"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { SOURCES, wiktionaryUrl } from "@/lib/tools/sources";
import type {
  SynonymGroup,
  SynonymItem,
  Synonyms as Found,
} from "@/lib/tools/synonyms";
import { lookUpSynonyms } from "./dictionary-actions";
import { createLookupStore, LookupTool, NewTabLink } from "./lookup-tool";
import { ToolSources } from "./tool-sources";

const store = createLookupStore<Found>();

function Item({ item, lang }: { item: SynonymItem; lang: string }) {
  const t = useTranslations("lookup");
  const tLabels = useTranslations("tools.labels");
  return (
    <li className="bg-muted/50 inline-flex flex-wrap items-baseline gap-1 rounded px-1.5 py-0.5">
      <span lang={lang}>{item.word}</span>
      {item.labels.map((label) => (
        <span key={label} className="bg-muted rounded px-1 text-xs">
          {item.region && (label === "dialectal" || label === "regional")
            ? t("label", { label: tLabels(label), region: item.region })
            : tLabels(label)}
        </span>
      ))}
      {/* Every source listing the word for this headword (criteria 2, 3). */}
      <span className="text-muted-foreground text-[0.65rem] tracking-tight">
        {item.sources.map((source) => (
          <span key={source} title={SOURCES[source].name} className="ml-0.5">
            <span aria-hidden>{SOURCES[source].short}</span>
            <span className="sr-only">{SOURCES[source].name}</span>
          </span>
        ))}
      </span>
    </li>
  );
}

function Items({ items, lang }: { items: SynonymItem[]; lang: string }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-sm">
      {items.map((item) => (
        <Item key={item.word} item={item} lang={lang} />
      ))}
    </ul>
  );
}

function Group({
  word,
  group,
  lang,
}: {
  word: string;
  group: SynonymGroup;
  lang: string;
}) {
  const t = useTranslations("synonyms");
  const tDefinitions = useTranslations("definitions");
  const id = useId();
  // Codes without a label of their own show Wikisłownik's Polish name.
  const pos = (entry: SynonymGroup["wiktionary"][number]) => {
    const key = `pos.${entry.pos}` as Parameters<typeof tDefinitions>[0];
    return tDefinitions.has(key) ? tDefinitions(key) : entry.posTitle;
  };
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h3 id={id} lang={lang} className="font-medium">
        {group.headword === word
          ? group.headword
          : t("shownFor", { headword: group.headword })}
      </h3>
      {group.wiktionary.length > 0 && (
        <section
          aria-label={SOURCES.wiktionary.name}
          className="grid gap-2 border-l-2 pl-3"
        >
          <h4 className="text-muted-foreground text-xs font-medium">
            {SOURCES.wiktionary.name}
          </h4>
          {group.wiktionary.map((entry, index) => (
            <div key={index} className="grid gap-1">
              <p className="text-muted-foreground text-xs">{pos(entry)}</p>
              <ol className="grid gap-2">
                {entry.senses.map((sense, senseIndex) => (
                  <li key={senseIndex} className="grid gap-1">
                    {(sense.index || sense.gloss) && (
                      <p className="text-muted-foreground text-xs" lang={lang}>
                        {sense.index && (
                          <span className="mr-1 tabular-nums">
                            {sense.index}
                          </span>
                        )}
                        {sense.gloss}
                      </p>
                    )}
                    <Items items={sense.synonyms} lang={lang} />
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">
            <NewTabLink href={wiktionaryUrl(group.headword)}>
              {t("entry")}
            </NewTabLink>
            , {SOURCES.wiktionary.licence}
          </p>
        </section>
      )}
      {group.thesaurus.length > 0 && (
        <section
          aria-label={SOURCES.dobryslownik.name}
          className="grid gap-2 border-l-2 pl-3"
        >
          <h4 className="text-muted-foreground text-xs font-medium">
            {SOURCES.dobryslownik.name}
          </h4>
          <ol className="grid gap-2">
            {group.thesaurus.map((sense, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("senseNumber", { number: index + 1 })}
                </span>
                <Items items={sense} lang={lang} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

export function Synonyms() {
  const t = useTranslations("synonyms");
  const tSources = useTranslations("tools.sources");
  return (
    <LookupTool
      store={store}
      lookUp={lookUpSynonyms}
      isEmpty={(found) => found.groups.length === 0}
      notFound={(word) => t("notFound", { word })}
      resultsLabel={(word) => t("results", { word })}
      renderFound={(found, word, lang) =>
        found.groups.map((group) => (
          <Group key={group.headword} word={word} group={group} lang={lang} />
        ))
      }
      footer={(result) =>
        result.ok && (
          <ToolSources
            sources={result.found.sources}
            changes={{
              wiktionary: tSources("changedSynonyms"),
              dobryslownik: tSources("changedThesaurus"),
            }}
          />
        )
      }
    />
  );
}
