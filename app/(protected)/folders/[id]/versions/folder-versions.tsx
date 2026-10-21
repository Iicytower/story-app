"use client";

import { HistoryIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { LocalDate } from "@/components/local-date";
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
import type { VersionListItem } from "@/lib/versions/queries";
import { VERSION_NAME_MAX_LENGTH } from "@/lib/versions/versions";
import { createFolderVersion, deleteFolderVersion } from "./actions";

export function FolderVersions({
  folderId,
  versions,
}: {
  folderId: string;
  versions: VersionListItem[];
}) {
  return (
    <section aria-labelledby="versions-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="versions-heading" className="text-sm font-medium">
          Versions
        </h2>
        <SaveVersionDialog folderId={folderId} />
      </div>
      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No versions yet.</p>
      ) : (
        <ul
          aria-label="Versions"
          className="flex flex-col divide-y rounded-lg border"
        >
          {versions.map((version) => (
            <li key={version.number} className="flex items-center gap-1 pr-2">
              <Link
                href={`/folders/${folderId}/versions/${version.number}`}
                className="hover:bg-muted/50 flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2"
              >
                <span className="truncate text-sm font-medium">
                  Version {version.number}: {version.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  <LocalDate iso={version.createdAt} withTime /> ·{" "}
                  {version.chapterCount}{" "}
                  {version.chapterCount === 1 ? "chapter" : "chapters"}
                </span>
              </Link>
              <DeleteVersionButton folderId={folderId} version={version} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SaveVersionDialog({ folderId }: { folderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon />
          Save version
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SaveVersionForm folderId={folderId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SaveVersionForm({
  folderId,
  onDone,
}: {
  folderId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createFolderVersion(folderId, name);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Save version</DialogTitle>
      </DialogHeader>
      <p className="text-muted-foreground text-sm">
        Saves the titles and contents of the folder&apos;s chapters as they
        are stored now, with their order. Notes are not part of versions.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="version-name">Name</Label>
        <Input
          id="version-name"
          value={name}
          maxLength={VERSION_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
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
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteVersionButton({
  folderId,
  version,
}: {
  folderId: string;
  version: VersionListItem;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = `Version ${version.number}`;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  function handleDelete(event: React.MouseEvent) {
    // Keep the dialog open until the action finishes so errors can be shown.
    event.preventDefault();
    startTransition(async () => {
      const result = await deleteFolderVersion(folderId, version.number);
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${label}`}>
          <Trash2Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete version?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} &ldquo;{version.name}&rdquo; will be removed. Chapters and
            other versions stay as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
