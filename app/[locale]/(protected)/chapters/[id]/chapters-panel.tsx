"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
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
import { recallScroll, rememberScroll } from "@/lib/editor/scroll-memory";
import type { EditorFolder } from "@/lib/folders/queries";
import { createStory } from "../actions";
import { MAX_NAME_LENGTH } from "@/lib/limits";

export function ChaptersPanel({
  folder,
  currentId,
  beforeLeave,
}: {
  folder: EditorFolder | null;
  currentId: string;
  // Saves the open chapter and the folder notes; a message means the user stays here.
  beforeLeave: () => Promise<string | null>;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLUListElement>(null);
  const t = useTranslations("chapters");

  useLayoutEffect(() => {
    const position = recallScroll(currentId, "chapters");
    if (listRef.current && typeof position === "number")
      listRef.current.scrollTop = position;
  }, [currentId]);

  if (!folder) {
    return (
      <p className="text-muted-foreground px-4 py-3 text-sm">{t("noFolder")}</p>
    );
  }

  async function open(href: string) {
    if ((await beforeLeave()) === null) router.push(href);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <span className="truncate text-sm font-medium">{folder.name}</span>
        <NewChapterDialog
          folderName={folder.name}
          lang={folder.language}
          beforeLeave={beforeLeave}
        />
      </div>
      <ul
        ref={listRef}
        aria-label={t("list")}
        onScroll={(event) =>
          rememberScroll(
            currentId,
            "chapters",
            event.currentTarget.scrollTop || null,
          )
        }
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {folder.chapters.map((chapter) => {
          const current = chapter.id === currentId;
          const href = `/chapters/${chapter.id}`;
          return (
            <li key={chapter.id} className={current ? "bg-muted" : undefined}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (!current) open(href);
                }}
                className={`hover:bg-muted/50 block truncate px-4 py-2 text-sm ${current ? "font-semibold" : ""}`}
              >
                {chapter.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewChapterDialog({
  folderName,
  lang,
  beforeLeave,
}: {
  folderName: string;
  lang: string;
  beforeLeave: () => Promise<string | null>;
}) {
  const t = useTranslations("chapters");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("newChapter")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <NewChapterForm
          folderName={folderName}
          lang={lang}
          beforeLeave={beforeLeave}
        />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function NewChapterForm({
  folderName,
  lang,
  beforeLeave,
}: {
  folderName: string;
  lang: string;
  beforeLeave: () => Promise<string | null>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("chapters");
  const tCommon = useTranslations("common");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const problem = await beforeLeave();
      if (problem) {
        setError(problem);
        return;
      }
      const result = await createStory(title, folderName);
      if (result.ok) router.push(`/chapters/${result.id}`);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("newChapter")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-chapter-title">{t("title")}</Label>
        <Input
          id="new-chapter-title"
          value={title}
          maxLength={MAX_NAME_LENGTH}
          lang={lang}
          spellCheck
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={error !== null}
        />
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
          {pending ? tCommon("creating") : tCommon("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
