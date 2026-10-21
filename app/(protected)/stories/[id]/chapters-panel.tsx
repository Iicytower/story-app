"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import type { EditorFolder } from "@/lib/folders/queries";
import { ReorderButtons } from "../../folders/reorder-buttons";
import { createStory, reorderChapter } from "../actions";
import { DeleteStoryButton } from "../delete-story-button";

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

  if (!folder) {
    return (
      <p className="text-muted-foreground px-4 py-3 text-sm">
        This story is not in a folder.
      </p>
    );
  }

  async function open(href: string) {
    if ((await beforeLeave()) === null) router.push(href);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <span className="truncate text-sm font-medium">{folder.name}</span>
        <NewChapterDialog folderName={folder.name} beforeLeave={beforeLeave} />
      </div>
      <ul aria-label="Chapters" className="min-h-0 flex-1 overflow-y-auto py-1">
        {folder.chapters.map((chapter, index) => {
          const current = chapter.id === currentId;
          const href = `/stories/${chapter.id}`;
          return (
            <li
              key={chapter.id}
              className={`flex items-center gap-1 pr-2 ${current ? "bg-muted" : ""}`}
            >
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (!current) open(href);
                }}
                className={`hover:bg-muted/50 min-w-0 flex-1 truncate px-4 py-2 text-sm ${current ? "font-semibold" : ""}`}
              >
                {chapter.title}
              </Link>
              {folder.chapterSort === "manual" && (
                <ReorderButtons
                  name={chapter.title}
                  isFirst={index === 0}
                  isLast={index === folder.chapters.length - 1}
                  action={reorderChapter.bind(null, chapter.id)}
                />
              )}
              <DeleteStoryButton
                id={chapter.id}
                title={chapter.title}
                onDeleted={
                  current
                    ? () => router.push(`/folders/${folder.id}`)
                    : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewChapterDialog({
  folderName,
  beforeLeave,
}: {
  folderName: string;
  beforeLeave: () => Promise<string | null>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          New chapter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <NewChapterForm folderName={folderName} beforeLeave={beforeLeave} />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function NewChapterForm({
  folderName,
  beforeLeave,
}: {
  folderName: string;
  beforeLeave: () => Promise<string | null>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const problem = await beforeLeave();
      if (problem) {
        setError(problem);
        return;
      }
      const result = await createStory(title, folderName);
      if (result.ok) router.push(`/stories/${result.id}`);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New chapter</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-chapter-title">Title</Label>
        <Input
          id="new-chapter-title"
          value={title}
          lang="pl"
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
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
