"use client";

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import {
  type ChapterField,
  type ComparedChapter,
  restoreSummary,
  type VersionComparison,
} from "@/lib/versions/versions";
import { restoreEntireVersion, restoreFolderVersion } from "../actions";
import { TextDiff } from "./text-diff";

type Status = ComparedChapter["status"] | "added";

const STATUS_LABELS: Record<Status, string> = {
  changed: "changed",
  unchanged: "unchanged",
  deleted: "deleted since",
  added: "added since",
};

// Shown next to a selected chapter.
const EFFECTS: Record<Status, string | null> = {
  changed: "will be reverted",
  unchanged: null,
  deleted: "will come back",
  added: "will be removed",
};

const FIELD_LABELS: Record<ChapterField, string> = {
  title: "Title",
  content: "Content",
};

const chapters = (count: number) =>
  `${count} ${count === 1 ? "chapter" : "chapters"}`;

export function RestoreForm({
  folderId,
  number,
  comparison,
}: {
  folderId: string;
  number: number;
  comparison: VersionComparison;
}) {
  const router = useRouter();
  const rows = [
    ...comparison.chapters.map((chapter) => ({
      id: chapter.storyId,
      title: chapter.title,
      status: chapter.status as Status,
      diffs: chapter.status === "changed" ? chapter.diffs : [],
    })),
    ...comparison.added.map(({ id, title }) => ({
      id,
      title,
      status: "added" as Status,
      diffs: [],
    })),
  ];
  // Unchanged chapters have nothing to restore.
  const selectable = rows.filter((row) => EFFECTS[row.status] !== null);
  const addedIds = new Set(comparison.added.map(({ id }) => id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allSelected =
    selectable.length > 0 && selected.size === selectable.length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      // The folder shows the restored chapters and the "Before restoring" version.
      if (result.ok) router.push(`/folders/${folderId}`);
      else setError(result.message);
    });
  }

  function restoreSelected() {
    const ids = [...selected];
    run(() =>
      restoreFolderVersion(
        folderId,
        number,
        ids.filter((id) => !addedIds.has(id)),
        ids.filter((id) => addedIds.has(id)),
      ),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-medium">Chapters</h2>
        {selectable.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelected(
                  new Set(
                    event.target.checked ? selectable.map((row) => row.id) : [],
                  ),
                )
              }
            />
            Select all
          </label>
        )}
        <Button
          variant="outline"
          onClick={restoreSelected}
          disabled={pending || selected.size === 0}
        >
          Restore selected
        </Button>
        <RestoreEntireDialog
          comparison={comparison}
          pending={pending}
          onConfirm={() => run(() => restoreEntireVersion(folderId, number))}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          This version has no chapters and the folder has none now.
        </p>
      ) : (
        <ul
          aria-label="Chapters in this version"
          className="flex flex-col divide-y rounded-lg border"
        >
          {rows.map((row) => {
            const effect = EFFECTS[row.status];
            return (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      disabled={effect === null}
                      checked={selected.has(row.id)}
                      onChange={(event) => toggle(row.id, event.target.checked)}
                    />
                    {row.status === "added" ? (
                      <Link
                        href={`/stories/${row.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{row.title}</span>
                    )}
                  </label>
                  {effect && selected.has(row.id) && (
                    <span className="text-sm font-medium">{effect}</span>
                  )}
                  <span className="text-muted-foreground text-sm">
                    {STATUS_LABELS[row.status]}
                  </span>
                </div>
                {row.diffs.length > 0 && (
                  <details>
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      Show changes
                    </summary>
                    <div className="mt-2 flex flex-col gap-3">
                      {row.diffs.map(({ field, parts }) => (
                        <div key={field} className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium">
                            {FIELD_LABELS[field]}
                          </h3>
                          <TextDiff parts={parts} />
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted-foreground text-sm">
        Notes are not part of versions and stay as they are.
      </p>
    </section>
  );
}

function RestoreEntireDialog({
  comparison,
  pending,
  onConfirm,
}: {
  comparison: VersionComparison;
  pending: boolean;
  onConfirm: () => void;
}) {
  const { reverted, returned, removed } = restoreSummary(comparison);
  const changes = [
    reverted > 0 && `${chapters(reverted)} will be reverted.`,
    returned > 0 && `${chapters(returned)} will come back.`,
    removed > 0 && `${chapters(removed)} added since will be removed.`,
    "The chapter order and sort mode will be restored.",
  ].filter(Boolean);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending}>
          <RotateCcwIcon />
          {pending ? "Restoring…" : "Restore entire version"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore entire version?</AlertDialogTitle>
          <AlertDialogDescription>
            The folder will match this version. The current state is saved as
            a new version first, so you can go back to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc pl-5 text-sm">
          {changes.map((change) => (
            <li key={change as string}>{change}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
