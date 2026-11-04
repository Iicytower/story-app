"use client";

import { FileUpIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
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
import { useDocumentLabels } from "@/lib/i18n/use-document-labels";
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
  const t = useTranslations("import");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <WithTooltip label={t("import")} className="md:hidden">
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileUpIcon />
            <span className="sr-only md:not-sr-only">{t("import")}</span>
          </Button>
        </DialogTrigger>
      </WithTooltip>
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
  const t = useTranslations("import");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const labels = useDocumentLabels();

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
      setError(tErrors("importFileTooLarge"));
      return;
    }
    setParsing(true);
    try {
      const { parseImportFile } = await import("@/lib/import/parse");
      const bytes = new Uint8Array(await picked.arrayBuffer());
      const parsed = await parseImportFile(picked.name, bytes, labels.chapter);
      setFile(parsed);
      setSplit(true);
      setTitle(
        parsed.chapters.length === 1 ? parsed.chapters[0].title : parsed.title,
      );
    } catch (parseError) {
      const { ImportError } = await import("@/lib/import/document");
      setError(
        parseError instanceof ImportError
          ? tErrors(parseError.key, parseError.values)
          : tErrors("importUnreadable"),
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
      setError(tErrors("importTooLarge"));
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
        setError(tErrors("importFailed"));
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

  const titleLabel = single
    ? t("storyTitle")
    : folderId
      ? null
      : t("newFolder");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-file">{t("file")}</Label>
        <Input
          id="import-file"
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
        />
      </div>
      {parsing && (
        <p className="text-muted-foreground text-sm">{t("reading")}</p>
      )}
      {file && (
        <>
          {file.lossy && <p className="text-sm">{t("lossy")}</p>}
          {file.unsplit && (
            <Label className="font-normal">
              <input
                type="checkbox"
                checked={split}
                onChange={(event) => handleSplit(event.target.checked)}
              />
              {t("split", { count: file.chapters.length })}
            </Label>
          )}
          {!folderId && single && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-folder">{t("folder")}</Label>
              <Input
                id="import-folder"
                list="import-folders"
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder={t("folderPlaceholder")}
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
              <p className="text-sm font-medium">
                {t("chapterCount", { count: chapters.length })}
              </p>
              <ol
                aria-label={t("chapters")}
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
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!file || pending}>
          {pending ? t("importing") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
