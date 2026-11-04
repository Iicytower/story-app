"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ExportSource } from "@/lib/export/document";
import { EXPORT_FORMATS, type ExportFormatId } from "@/lib/export/formats";
import { useDocumentLabels } from "@/lib/i18n/use-document-labels";
import { safeFileName } from "@/lib/stories/export";

function download(data: Uint8Array | string, name: string, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({
  open,
  onOpenChange: setOpen,
  dataUrl,
  fallbackName,
  beforeExport,
  chapterFiles = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataUrl: string;
  fallbackName: string;
  beforeExport?: () => Promise<boolean>;
  chapterFiles?: boolean;
}) {
  const [formatId, setFormatId] = useState<ExportFormatId>("docx");
  const [includeExtras, setIncludeExtras] = useState(false);
  const [separateFiles, setSeparateFiles] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("export");
  const labels = useDocumentLabels();

  async function runExport() {
    const format = EXPORT_FORMATS.find(({ id }) => id === formatId)!;
    setError(null);
    setPending(true);
    try {
      if (beforeExport && !(await beforeExport())) {
        setOpen(false);
        return;
      }
      const response = await fetch(dataUrl);
      if (!response.ok) {
        setError(t("loadFailed"));
        return;
      }
      const source: ExportSource = await response.json();
      const { buildChapterFilesZip, buildExport } =
        await import("@/lib/export/build");
      const baseName = safeFileName(source.title, fallbackName);
      if (separateFiles) {
        const zip = await buildChapterFilesZip(
          formatId,
          source,
          includeExtras,
          labels,
        );
        download(zip, `${baseName}.zip`, "application/zip");
      } else {
        const data = await buildExport(formatId, source, includeExtras, labels);
        download(data, `${baseName}.${format.extension}`, format.mime);
      }
      setOpen(false);
    } catch {
      setError(t("createFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="export-format">{t("format")}</Label>
          <select
            id="export-format"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={formatId}
            onChange={(event) =>
              setFormatId(event.target.value as ExportFormatId)
            }
          >
            {EXPORT_FORMATS.map(({ id }) => (
              <option key={id} value={id}>
                {t(`formats.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <Label className="font-normal">
          <input
            type="checkbox"
            checked={includeExtras}
            onChange={(event) => setIncludeExtras(event.target.checked)}
          />
          {t("includeExtras")}
        </Label>
        {chapterFiles && (
          <Label className="font-normal">
            <input
              type="checkbox"
              checked={separateFiles}
              onChange={(event) => setSeparateFiles(event.target.checked)}
            />
            {t("separateFiles")}
          </Label>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button onClick={runExport} disabled={pending}>
            {pending ? t("exporting") : t("export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
