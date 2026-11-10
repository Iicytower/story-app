"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { PREDEFINED_CHIP } from "@/components/tag-chips";
import { usePredefinedTags, useTagLabel } from "@/components/predefined-tags";
import type { Locale } from "@/i18n/routing";
import {
  canonicalTags,
  matchingSuggestions,
  type TagChoice,
} from "@/lib/tags/predefined";
import { splitTagInput } from "@/lib/tags/tags";

export type TagOptions = {
  // The author's own tags, listed to pick from.
  own: string[];
  // Tags of public chapters, only suggested while typing (D79).
  known: string[];
};

type TagsDialogProps = {
  name: string;
  tags?: string[];
  folderTags?: string[];
  options: TagOptions;
  action: (tags: string[]) => Promise<ActionResult>;
};

export function TagsDialog({
  open,
  onOpenChange,
  ...props
}: TagsDialogProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <TagsForm {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

const CHIP = "rounded-full border px-2 py-0.5 text-xs";
const PRESSED = "bg-primary text-primary-foreground border-primary";

function TagsForm({
  name,
  tags: currentTags = [],
  folderTags = [],
  options,
  action,
  onDone,
}: TagsDialogProps & { onDone: () => void }) {
  const [tags, setTags] = useState(currentTags);
  const [input, setInput] = useState("");
  // Added in this dialog: they stay listed after being switched off.
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const predefined = usePredefinedTags();
  const locale = useLocale() as Locale;
  const labelOf = useTagLabel();

  const categories: TagChoice[] = predefined
    .map(({ key, labels }) => ({ tag: key, text: labels[locale] }))
    .toSorted((a, b) => a.text.localeCompare(b.text));
  const own: TagChoice[] = [
    ...new Set([
      ...options.own,
      ...currentTags,
      ...added,
      ...tags,
      ...folderTags,
    ]),
  ]
    .filter((tag) => labelOf(tag) === null)
    .toSorted((a, b) => a.localeCompare(b))
    .map((tag) => ({ tag, text: tag }));
  const known: TagChoice[] = options.known
    .filter((tag) => labelOf(tag) === null)
    .map((tag) => ({ tag, text: tag }));
  const suggestions = matchingSuggestions(
    input,
    [...categories, ...known].filter(
      ({ tag }) => !tags.includes(tag) && !folderTags.includes(tag),
    ),
  );

  const typed = () => canonicalTags(splitTagInput(input), predefined);
  const withInput = () => [...new Set([...tags, ...typed()])];

  function add(newTags: string[]) {
    setTags([...new Set([...tags, ...newTags])]);
    setAdded([...added, ...newTags]);
    setInput("");
  }

  function toggle(tag: string) {
    setTags(
      tags.includes(tag)
        ? tags.filter((other) => other !== tag)
        : [...tags, tag],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await action(withInput());
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  const group = (label: string, choices: TagChoice[], style: string) =>
    choices.length > 0 && (
      <ul aria-label={label} className="flex flex-wrap gap-1">
        {choices.map(({ tag, text }) => {
          const inherited = folderTags.includes(tag);
          const pressed = inherited || tags.includes(tag);
          return (
            <li key={tag}>
              <button
                type="button"
                aria-pressed={pressed}
                disabled={inherited}
                title={inherited ? t("fromFolder") : undefined}
                onClick={() => toggle(tag)}
                className={`${CHIP} ${pressed ? PRESSED : style} ${inherited ? "border-dashed opacity-70" : ""}`}
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("tagsFor", { name })}</DialogTitle>
      </DialogHeader>
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {group(
          t("categories"),
          categories,
          `${PREDEFINED_CHIP} border-transparent`,
        )}
        {group(t("ownTags"), own, "bg-muted border-transparent")}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("add")}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={input}
            autoComplete="off"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(typed());
              }
            }}
            aria-invalid={error !== null}
          />
          <Button type="button" variant="outline" onClick={() => add(typed())}>
            {t("addButton")}
          </Button>
        </div>
        {suggestions.length > 0 && (
          <ul aria-label={t("suggestions")} className="flex flex-wrap gap-1">
            {suggestions.map(({ tag, text }) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => add([tag])}
                  className={`${CHIP} hover:bg-muted border-dashed ${labelOf(tag) ? "text-primary" : ""}`}
                >
                  {text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
