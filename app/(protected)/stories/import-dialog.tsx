"use client";

import { FileUpIcon } from "lucide-react";
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
import type { ImportedFile } from "@/lib/import/document";
import {
  importTextBytes,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_TEXT_BYTES,
} from "@/lib/import/limits";
import { importStories, type ImportTarget } from "./actions";

const ACCEPT = ".md,.txt,.html,.docx,.odt,.pdf,.epub,.fb2,.zip";

export function ImportDialog({
  folderNames = [],
  defaultFolder = "",
  folderId,
}: {
  folderNames?: string[];
  defaultFolder?: string;
  // Set on a folder's page: everything goes into that folder.
  folderId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUpIcon />
          <span className="sr-only md:not-sr-only">Import…</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ImportForm
          folderNames={folderNames}
          defaultFolder={defaultFolder}
          folderId={folderId}
          onImported={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// Separate component so its state resets each time the dialog content mounts.
function ImportForm({
  folderNames,
  defaultFolder,
  folderId,
  onImported,
}: {
  folderNames: string[];
  defaultFolder: string;
  folderId?: string;
  onImported: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<ImportedFile | null>(null);
  const [split, setSplit] = useState(true);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState(defaultFolder);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chapters = !file
    ? []
    : split || !file.unsplit
      ? file.chapters
      : [file.unsplit];
  const single = chapters.length === 1;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    setFile(null);
    setError(null);
    if (!picked) return;
    if (picked.size > MAX_IMPORT_FILE_BYTES) {
      setError("This file is larger than 50 MB.");
      return;
    }
    setParsing(true);
    try {
      const { parseImportFile } = await import("@/lib/import/parse");
      const bytes = new Uint8Array(await picked.arrayBuffer());
      const parsed = await parseImportFile(picked.name, bytes);
      setFile(parsed);
      setSplit(true);
      setTitle(
        parsed.chapters.length === 1 ? parsed.chapters[0].title : parsed.title,
      );
    } catch (parseError) {
      const { ImportError } = await import("@/lib/import/document");
      setError(
        parseError instanceof ImportError
          ? parseError.message
          : "This file could not be read.",
      );
    } finally {
      setParsing(false);
    }
  }

  function handleSplit(checked: boolean) {
    setSplit(checked);
    if (file?.unsplit) setTitle(checked ? file.title : file.unsplit.title);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const named = single ? [{ ...chapters[0], title }] : chapters;
    if (importTextBytes(named, file.folderNotes) > MAX_IMPORT_TEXT_BYTES) {
      setError("This text is too large to import.");
      return;
    }
    const target: ImportTarget = folderId
      ? { kind: "folder", id: folderId }
      : single
        ? { kind: "named", name: folder }
        : { kind: "new", name: title };
    startTransition(async () => {
      // Text full of line breaks can still outgrow the request limit once encoded.
      const result = await importStories(target, named, file.folderNotes).catch(
        () => null,
      );
      if (!result) {
        setError("This text could not be imported. It may be too large.");
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // The folder's own page stays open, so the dialog has to close itself.
      onImported();
      router.push(
        single ? `/stories/${result.storyId}` : `/folders/${result.folderId}`,
      );
    });
  }

  const titleLabel = single ? "Title" : folderId ? null : "New folder";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Import</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-file">File</Label>
        <Input
          id="import-file"
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
        />
      </div>
      {parsing && <p className="text-muted-foreground text-sm">Reading…</p>}
      {file && (
        <>
          {file.lossy && (
            <p className="text-sm">
              Formatting cannot be kept: a PDF only gives back the text.
            </p>
          )}
          {file.unsplit && (
            <Label className="font-normal">
              <input
                type="checkbox"
                checked={split}
                onChange={(event) => handleSplit(event.target.checked)}
              />
              Split into {file.chapters.length} chapters
            </Label>
          )}
          {!folderId && single && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-folder">Folder</Label>
              <Input
                id="import-folder"
                list="import-folders"
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="Choose or type a new folder"
                autoComplete="off"
              />
              <datalist id="import-folders">
                {folderNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          )}
          {titleLabel && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-title">{titleLabel}</Label>
              <Input
                id="import-title"
                value={title}
                lang="pl"
                spellCheck
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          )}
          {!single && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{chapters.length} chapters</p>
              <ol
                aria-label="Chapters to import"
                className="text-muted-foreground max-h-40 list-decimal overflow-y-auto pl-5 text-sm"
              >
                {chapters.map((chapter, index) => (
                  <li key={index}>{chapter.title}</li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
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
        <Button type="submit" disabled={!file || pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </DialogFooter>
    </form>
  );
}
