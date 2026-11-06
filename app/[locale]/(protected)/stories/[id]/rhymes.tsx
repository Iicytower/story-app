"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/lib/tools/rhymes-import";
import {
  isFiltered,
  MAX_SYLLABLES,
  NO_FILTERS,
  type RhymeFilters,
  type RhymeGroup,
  type Rhymes as Found,
} from "@/lib/tools/rhymes";
import { lookUpRhymes } from "./dictionary-actions";
import { createLookupStore, LookupTool } from "./lookup-tool";
import { ToolSources } from "./tool-sources";

const store = createLookupStore<Found>();

// The filters outlive the dialog like the last lookup (D62).
let filters = NO_FILTERS;
const filterListeners = new Set<() => void>();
const filterStore = {
  get: () => filters,
  subscribe(listener: () => void) {
    filterListeners.add(listener);
    return () => {
      filterListeners.delete(listener);
    };
  },
  set(next: RhymeFilters) {
    filters = next;
    for (const listener of filterListeners) listener();
  },
};

const SELECT = "border-input bg-background h-9 rounded-md border px-2 text-sm";
const COUNTS = Array.from({ length: MAX_SYLLABLES }, (_, index) => index + 1);
const PARTS = Object.keys(PARTS_OF_SPEECH) as PartOfSpeech[];

// Part of speech and syllables (task 35); a change looks the word up again.
function Filters({ again }: { again: () => void }) {
  const t = useTranslations("rhymes.filters");
  const current = useSyncExternalStore(
    filterStore.subscribe,
    filterStore.get,
    () => NO_FILTERS,
  );
  const id = useId();
  const first = useRef<HTMLSelectElement>(null);
  const change = (next: Partial<RhymeFilters>) => {
    filterStore.set({ ...current, ...next });
    again();
  };
  const count = (value: number) =>
    value === MAX_SYLLABLES ? t("orMore", { count: value }) : String(value);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor={`${id}-pos`}>{t("partOfSpeech")}</Label>
        <select
          ref={first}
          id={`${id}-pos`}
          className={SELECT}
          value={current.pos ?? ""}
          onChange={(event) =>
            change({ pos: (event.target.value || null) as PartOfSpeech | null })
          }
        >
          <option value="">{t("any")}</option>
          {PARTS.map((part) => (
            <option key={part} value={part}>
              {t(`parts.${part}`)}
            </option>
          ))}
        </select>
      </div>
      <div
        role="group"
        aria-label={t("syllables")}
        className="flex items-end gap-2"
      >
        <div className="grid gap-1">
          <Label htmlFor={`${id}-min`}>{t("syllablesFrom")}</Label>
          <select
            id={`${id}-min`}
            className={SELECT}
            value={current.min}
            onChange={(event) => change({ min: Number(event.target.value) })}
          >
            {/* "From" above "to" cannot be chosen. */}
            {COUNTS.map((value) => (
              <option key={value} value={value} disabled={value > current.max}>
                {count(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-max`}>{t("syllablesTo")}</Label>
          <select
            id={`${id}-max`}
            className={SELECT}
            value={current.max}
            onChange={(event) => change({ max: Number(event.target.value) })}
          >
            {COUNTS.map((value) => (
              <option key={value} value={value} disabled={value < current.min}>
                {count(value)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isFiltered(current) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() => {
            // The button goes away with the filters.
            first.current?.focus();
            change(NO_FILTERS);
          }}
        >
          {t("clear")}
        </Button>
      )}
    </div>
  );
}

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
      lookUp={(word) => lookUpRhymes(word, filterStore.get())}
      isEmpty={(found) => found.groups.length === 0}
      notFound={(word, found) =>
        isFiltered(found.filters)
          ? t("notFoundFiltered", { word })
          : t("notFound", { word })
      }
      options={(again) => <Filters again={again} />}
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
