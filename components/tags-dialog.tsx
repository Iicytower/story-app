"use client";

import { TagIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { inheritedOnly, splitTagInput } from "@/lib/tags/tags";

type TagsDialogProps = {
  name: string;
  tags?: string[];
  folderTags?: string[];
  suggestions: string[];
  // The chapter row has room for an icon only.
  compact?: boolean;
  action: (tags: string[]) => Promise<ActionResult>;
};

export function TagsDialog(props: TagsDialogProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("tags");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.compact ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("tagsFor", { name: props.name })}
          >
            <TagIcon />
          </Button>
        ) : (
          <Button variant="outline">
            <TagIcon />
            {t("tags")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <TagsForm {...props} onDone={() => setOpen(false)} />
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

  const withInput = () => [...new Set([...tags, ...splitTagInput(input)])];

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
          {tags.map((tag) => (
            <li
              key={tag}
              className="bg-muted flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs"
            >
              {tag}
              <button
                type="button"
                aria-label={t("remove", { tag })}
                onClick={() => setTags(tags.filter((other) => other !== tag))}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
          {inherited.map((tag) => (
            <li
              key={tag}
              title={t("fromFolder")}
              className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs"
            >
              {tag}
            </li>
          ))}
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
          {suggestions
            .filter((tag) => !tags.includes(tag) && !folderTags.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
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
