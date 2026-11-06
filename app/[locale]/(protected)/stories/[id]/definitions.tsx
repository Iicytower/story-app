"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import type {
  DefinitionGroup,
  Definitions as Found,
  Sense,
} from "@/lib/tools/definitions";
import { externalLinks, SOURCES, wiktionaryUrl } from "@/lib/tools/sources";
import { lookUpDefinitions } from "./dictionary-actions";
import { useEditorTool } from "./tool-context";
import { ToolSources } from "./tool-sources";

type Result =
  | { ok: true; word: string; found: Found }
  | { ok: false; word: string; message: string };

// The last lookup outlives the dialog, the tab and the chapter until the page reloads (decision
// of the user, criterion 5). Module state, so a dialog reopened during a lookup is still locked
// and gets the answer.
interface State {
  query: string;
  result: Result | null;
  pending: boolean;
}
const INITIAL: State = { query: "", result: null, pending: false };
let state = INITIAL;
const listeners = new Set<() => void>();

function update(change: Partial<State>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function NewTabLink({ href, children }: { href: string; children: string }) {
  const t = useTranslations("definitions");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline"
    >
      {children}
      <ExternalLinkIcon aria-hidden className="size-3" />
      <span className="sr-only">{t("newTab")}</span>
    </a>
  );
}

function SenseItem({ sense }: { sense: Sense }) {
  const t = useTranslations("definitions");
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
              ? t("label", {
                  label: t(`labels.${label}`),
                  region: sense.region,
                })
              : t(`labels.${label}`)}
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
  const { lang } = useEditorTool();
  const { query, result, pending } = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const word = query.trim();
    if (!word || state.pending) return;
    update({ pending: true });
    // A thrown action ("Failed to find Server Action" after a deploy) is a message too.
    const response: ActionResult<{ word: string } & Found> | null =
      await lookUpDefinitions(word).catch(() => null);
    update({
      pending: false,
      result: !response
        ? { ok: false, word, message: t("failed") }
        : response.ok
          ? {
              ok: true,
              word: response.word,
              found: { groups: response.groups, sources: response.sources },
            }
          : { ok: false, word, message: response.message },
    });
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={search}>
        {/* Locked while a lookup runs (task 25, criterion 9). */}
        <fieldset disabled={pending} className="flex items-end gap-2">
          <div className="grid flex-1 gap-1">
            <Label htmlFor={inputId}>{t("word")}</Label>
            <Input
              ref={input}
              id={inputId}
              lang={lang}
              value={query}
              maxLength={50}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => update({ query: event.target.value })}
            />
          </div>
          <Button type="submit">
            {pending ? t("searching") : t("search")}
          </Button>
        </fieldset>
      </form>
      {result && (
        <div className="grid gap-4">
          {!result.ok ? (
            <p role="alert" className="text-destructive text-sm">
              {result.message}
            </p>
          ) : result.found.groups.length === 0 ? (
            <p role="status" className="text-sm">
              {t("notFound", { word: result.word })}
            </p>
          ) : (
            <section
              aria-label={t("results", { word: result.word })}
              className="grid gap-4"
            >
              {result.found.groups.map((group) => (
                <Group
                  key={group.headword}
                  word={result.word}
                  group={group}
                  lang={lang}
                />
              ))}
            </section>
          )}
          <p className="flex flex-wrap gap-x-3 text-sm">
            {t("lookElsewhere", { word: result.word })}
            {externalLinks(result.word).map(({ id, url }) => (
              <NewTabLink key={id} href={url}>
                {t(`external.${id}`)}
              </NewTabLink>
            ))}
          </p>
          {result.ok && <ToolSources sources={result.found.sources} />}
        </div>
      )}
    </div>
  );
}
