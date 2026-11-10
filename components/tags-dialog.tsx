"use client";

import { XIcon } from "lucide-react";
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
import { WithTooltip } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { PREDEFINED_CHIP } from "@/components/tag-chips";
import { usePredefinedTags, useTagLabel } from "@/components/predefined-tags";
import type { Locale } from "@/i18n/routing";
import { canonicalTags } from "@/lib/tags/predefined";
import { inheritedOnly, splitTagInput } from "@/lib/tags/tags";

type TagsDialogProps = {
  name: string;
  tags?: string[];
  folderTags?: string[];
  suggestions: string[];
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

function TagsForm({
  name,
  tags: currentTags = [],
  folderTags = [],
  suggestions,
  action,
  onDone,
}: TagsDialogProps & { onDone: () => void }) {
  const [tags, setTags] = useState(currentTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const listId = useId();
  const inherited = inheritedOnly(tags, folderTags);
  const predefined = usePredefinedTags();
  const locale = useLocale() as Locale;
  const labelOf = useTagLabel();
  const unused = (tag: string) =>
    !tags.includes(tag) && !folderTags.includes(tag);
  // Predefined ones by their label, which addInput turns back into the key (D79).
  const options = [
    ...predefined
      .filter(({ key }) => unused(key))
      .map(({ labels }) => labels[locale])
      .toSorted((a, b) => a.localeCompare(b)),
    ...suggestions.filter((tag) => unused(tag) && labelOf(tag) === null),
  ];

  const withInput = () => [
    ...new Set([...tags, ...canonicalTags(splitTagInput(input), predefined)]),
  ];

  function addInput() {
    setTags(withInput());
    setInput("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await action(withInput());
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("tagsFor", { name })}</DialogTitle>
      </DialogHeader>
      {tags.length + inherited.length > 0 && (
        <ul aria-label={t("current")} className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const label = labelOf(tag);
            const text = label ?? tag;
            return (
              <li
                key={tag}
                title={label ? t("predefined") : undefined}
                className={`${label ? PREDEFINED_CHIP : "bg-muted"} flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs`}
              >
                {text}
                <WithTooltip label={t("remove", { tag: text })}>
                  <button
                    type="button"
                    aria-label={t("remove", { tag: text })}
                    onClick={() =>
                      setTags(tags.filter((other) => other !== tag))
                    }
                  >
                    <XIcon className="size-3" />
                  </button>
                </WithTooltip>
              </li>
            );
          })}
          {inherited.map((tag) => {
            const label = labelOf(tag);
            return (
              <li
                key={tag}
                title={t("fromFolder")}
                className={`${label ? "text-primary" : "text-muted-foreground"} rounded-full border border-dashed px-2 py-0.5 text-xs`}
              >
                {label ?? tag}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("add")}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            list={listId}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addInput();
              }
            }}
            aria-invalid={error !== null}
          />
          <Button type="button" variant="outline" onClick={addInput}>
            {t("addButton")}
          </Button>
        </div>
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
