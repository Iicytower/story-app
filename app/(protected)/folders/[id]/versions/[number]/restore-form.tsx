"use client";

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type {
  ChapterField,
  ComparedChapter,
  VersionComparison,
} from "@/lib/versions/versions";
import { restoreFolderVersion } from "../actions";
import { TextDiff } from "./text-diff";

const STATUS_LABELS: Record<ComparedChapter["status"], string> = {
  changed: "changed",
  unchanged: "unchanged",
  deleted: "deleted since",
};

const FIELD_LABELS: Record<ChapterField, string> = {
  title: "Title",
  content: "Content",
  notes: "Notes",
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
  const { chapters, added } = comparison;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allSelected = chapters.length > 0 && selected.size === chapters.length;

  function toggle(storyId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(storyId);
      else next.delete(storyId);
      return next;
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreFolderVersion(folderId, number, [
        ...selected,
      ]);
      // The folder shows the restored chapters and the "Before restoring" version.
      if (result.ok) router.push(`/folders/${folderId}`);
      else setError(result.message);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-medium">Chapters in this version</h2>
        {chapters.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelected(
                  new Set(
                    event.target.checked
                      ? chapters.map((chapter) => chapter.storyId)
                      : [],
                  ),
                )
              }
            />
            Select all
          </label>
        )}
        <Button
          onClick={handleRestore}
          disabled={pending || selected.size === 0}
        >
          <RotateCcwIcon />
          {pending ? "Restoring…" : "Restore selected"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {chapters.length === 0 ? (
        <p className="text-muted-foreground">
          This version has no chapters.
        </p>
      ) : (
        <ul
          aria-label="Chapters in this version"
          className="flex flex-col divide-y rounded-lg border"
        >
          {chapters.map((chapter) => (
            <li key={chapter.storyId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(chapter.storyId)}
                    onChange={(event) =>
                      toggle(chapter.storyId, event.target.checked)
                    }
                  />
                  <span className="truncate font-medium">{chapter.title}</span>
                </label>
                <span className="text-muted-foreground text-sm">
                  {STATUS_LABELS[chapter.status]}
                </span>
              </div>
              {chapter.status === "changed" && (
                <details>
                  <summary className="text-muted-foreground cursor-pointer text-sm">
                    Show changes
                  </summary>
                  <div className="mt-2 flex flex-col gap-3">
                    {chapter.diffs.map(({ field, parts }) => (
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
          ))}
        </ul>
      )}
      {added.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Added since</h2>
          <p className="text-muted-foreground text-sm">
            Not in this version. Restoring leaves them as they are.
          </p>
          <ul aria-label="Added since" className="list-disc pl-5 text-sm">
            {added.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/stories/${chapter.id}`}
                  className="hover:underline"
                >
                  {chapter.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
