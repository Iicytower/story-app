"use client";

import { RotateCcwIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
  type ComparedChapter,
  restoreSummary,
  type VersionComparison,
} from "@/lib/versions/versions";
import { restoreEntireVersion, restoreFolderVersion } from "../actions";
import { TextDiff } from "./text-diff";

type Status = ComparedChapter["status"] | "added";

// Shown next to a selected chapter (versions.effects); unchanged chapters have nothing to restore.
const EFFECTS: Record<Status, Exclude<Status, "unchanged"> | null> = {
  changed: "changed",
  unchanged: null,
  deleted: "deleted",
  added: "added",
};

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
  const t = useTranslations("versions");
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
      if (result.ok) router.push(`/books/${folderId}`);
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
        <h2 className="mr-auto font-medium">{t("chapters")}</h2>
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
            {t("selectAll")}
          </label>
        )}
        <Button
          variant="outline"
          onClick={restoreSelected}
          disabled={pending || selected.size === 0}
        >
          {t("restoreSelected")}
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
        <p className="text-muted-foreground">{t("emptyComparison")}</p>
      ) : (
        <ul
          aria-label={t("chaptersInVersion")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {rows.map((row) => {
            const effect = EFFECTS[row.status];
            return (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-3">
                {/* The whole row toggles the checkbox, not just the 14 px box. */}
                <label
                  className={`flex items-center gap-3 ${effect === null ? "" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    disabled={effect === null}
                    checked={selected.has(row.id)}
                    onChange={(event) => toggle(row.id, event.target.checked)}
                    // The label also holds the status and effect, which would join the name.
                    aria-label={row.title}
                    className="size-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 items-center">
                    {row.status === "added" ? (
                      <Link
                        href={`/chapters/${row.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{row.title}</span>
                    )}
                  </span>
                  {effect && selected.has(row.id) && (
                    <span className="text-sm font-medium">
                      {t(`effects.${effect}`)}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm">
                    {t(`status.${row.status}`)}
                  </span>
                </label>
                {row.diffs.length > 0 && (
                  <details>
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      {t("showChanges")}
                    </summary>
                    <div className="mt-2 flex flex-col gap-3">
                      {row.diffs.map(({ field, parts }) => (
                        <div key={field} className="flex flex-col gap-1">
                          <h3 className="text-sm font-medium">
                            {t(`fields.${field}`)}
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
      <p className="text-muted-foreground text-sm">{t("notesNotIncluded")}</p>
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
  const t = useTranslations("versions");
  const tCommon = useTranslations("common");
  const { reverted, returned, removed } = restoreSummary(comparison);
  const unchanged = reverted + returned + removed === 0;
  const changes = [
    reverted > 0 && t("willRevert", { count: reverted }),
    returned > 0 && t("willReturn", { count: returned }),
    removed > 0 && t("willRemove", { count: removed }),
    t("orderRestored"),
  ].filter(Boolean);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending || unchanged}>
          <RotateCcwIcon />
          {pending ? t("restoring") : t("restoreEntire")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("restoreEntireTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("restoreEntireDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc pl-5 text-sm">
          {changes.map((change) => (
            <li key={change as string}>{change}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("restore")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
