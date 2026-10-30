"use client";

import { FileDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ExportSource } from "@/lib/export/document";
import { EXPORT_FORMATS, type ExportFormatId } from "@/lib/export/formats";
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
  dataUrl,
  fallbackName,
  beforeExport,
}: {
  dataUrl: string;
  fallbackName: string;
  beforeExport?: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [formatId, setFormatId] = useState<ExportFormatId>("docx");
  const [includeExtras, setIncludeExtras] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError("The export data could not be loaded.");
        return;
      }
      const source: ExportSource = await response.json();
      const { buildExport } = await import("@/lib/export/build");
      const data = await buildExport(formatId, source, includeExtras);
      const name = `${safeFileName(source.title, fallbackName)}.${format.extension}`;
      download(data, name, format.mime);
      setOpen(false);
    } catch {
      setError("The file could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileDownIcon />
          <span className="sr-only md:not-sr-only">Export as…</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export as</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="export-format">Format</Label>
          <select
            id="export-format"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={formatId}
            onChange={(event) =>
              setFormatId(event.target.value as ExportFormatId)
            }
          >
            {EXPORT_FORMATS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
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
          Include comments and notes
        </Label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button onClick={runExport} disabled={pending}>
            {pending ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
