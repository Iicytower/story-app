"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { useEditorTool } from "./tool-context";

// The search form and result of the dictionary tiles (tasks 32–34).

export type LookupResult<F> =
  | { ok: true; word: string; found: F }
  | { ok: false; word: string; message: string };

interface State<F> {
  query: string;
  result: LookupResult<F> | null;
  pending: boolean;
  // An option changed during the lookup: one more follows.
  queued: boolean;
}

export interface LookupStore<F> {
  get: () => State<F>;
  initial: State<F>;
  update: (change: Partial<State<F>>) => void;
  subscribe: (listener: () => void) => () => void;
}

// The last lookup of a tile outlives the dialog, the tab and the chapter until the page reloads
// (decision of the user, D62). Module state, one store per tile, so a dialog reopened during a
// lookup is still locked and gets the answer.
export function createLookupStore<F>(): LookupStore<F> {
  const initial: State<F> = {
    query: "",
    result: null,
    pending: false,
    queued: false,
  };
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    initial,
    update(change) {
      state = { ...state, ...change };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function NewTabLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const t = useTranslations("lookup");
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

export function LookupTool<F>({
  store,
  lookUp,
  isEmpty,
  notFound,
  resultsLabel,
  renderFound,
  footer,
  options,
}: {
  store: LookupStore<F>;
  lookUp: (word: string) => Promise<ActionResult<{ word: string } & F>>;
  isEmpty: (found: F) => boolean;
  notFound: (word: string, found: F) => string;
  resultsLabel: (word: string) => string;
  renderFound: (found: F, word: string, lang: string) => ReactNode;
  // Shown under any result, also a failed one.
  footer?: (result: LookupResult<F>) => ReactNode;
  // Controls under the word; `again` looks up the word of the result again. They stay enabled
  // during a lookup, so stepping through a select with the arrow keys keeps the focus, and
  // changes made meanwhile end in one more lookup.
  options?: (again: () => void) => ReactNode;
}) {
  const t = useTranslations("lookup");
  const { lang } = useEditorTool();
  const { query, result, pending } = useSyncExternalStore(
    store.subscribe,
    store.get,
    () => store.initial,
  );
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function search(event: React.FormEvent) {
    event.preventDefault();
    await run(query.trim(), input.current);
  }

  function again() {
    if (store.get().pending) {
      store.update({ queued: true });
      return;
    }
    const last = store.get().result;
    if (last) void run(last.word, null);
  }

  async function run(word: string, focus: HTMLElement | null) {
    if (!word || store.get().pending) return;
    store.update({ pending: true });
    // A thrown action ("Failed to find Server Action" after a deploy) is a message too.
    const response = await lookUp(word).catch(() => null);
    let next: LookupResult<F>;
    if (!response) next = { ok: false, word, message: t("failed") };
    else if (!response.ok)
      next = { ok: false, word, message: response.message };
    else {
      // The rest of the answer (and its `ok`) is the tile's own data.
      const { word: answered, ...found } = response;
      next = { ok: true, word: answered, found: found as unknown as F };
    }
    store.update({ pending: false, result: next });
    if (store.get().queued) {
      store.update({ queued: false });
      again();
      return;
    }
    requestAnimationFrame(() => focus?.focus());
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={search} className="grid gap-3">
        {/* Locked while a lookup runs (task 25, criterion 9). */}
        <fieldset disabled={pending}>
          <div className="flex items-end gap-2">
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
                onChange={(event) =>
                  store.update({ query: event.target.value })
                }
              />
            </div>
            <Button type="submit">
              {pending ? t("searching") : t("search")}
            </Button>
          </div>
        </fieldset>
        {options?.(again)}
      </form>
      {result && (
        <div className="grid gap-4">
          {!result.ok ? (
            <p role="alert" className="text-destructive text-sm">
              {result.message}
            </p>
          ) : isEmpty(result.found) ? (
            <p role="status" className="text-sm">
              {notFound(result.word, result.found)}
            </p>
          ) : (
            <section
              aria-label={resultsLabel(result.word)}
              className="grid gap-4"
            >
              {renderFound(result.found, result.word, lang)}
            </section>
          )}
          {footer?.(result)}
        </div>
      )}
    </div>
  );
}
