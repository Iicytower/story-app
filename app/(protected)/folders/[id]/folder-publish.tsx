"use client";

import { CheckIcon, CopyIcon, GlobeIcon, LinkIcon } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ExportDialog } from "@/components/export-dialog";
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
import { Input } from "@/components/ui/input";
import { publishAllChapters, setFolderPublished } from "../actions";

const subscribeNever = () => () => {};

export function FolderPublish({
  id,
  publicPath,
  hiddenCount,
}: {
  id: string;
  publicPath: string | null;
  hiddenCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // Empty during SSR, so the absolute link is only rendered after hydration.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const publicUrl = publicPath && origin + publicPath;

  function run(action: () => ReturnType<typeof publishAllChapters>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <ExportDialog
          dataUrl={`/folders/${id}/export/data`}
          fallbackName="folder"
          chapterFiles
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setFolderPublished(id, !publicPath))}
        >
          <GlobeIcon />
          {publicPath ? "Unpublish" : "Publish"}
        </Button>
        {publicPath && hiddenCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={pending}>
                Publish all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish all chapters?</AlertDialogTitle>
                <AlertDialogDescription>
                  {hiddenCount} hidden{" "}
                  {hiddenCount === 1 ? "chapter" : "chapters"} will become
                  public.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run(() => publishAllChapters(id))}
                >
                  Publish all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive order-last w-full text-sm">
          {error}
        </p>
      )}
      {publicUrl && (
        <div className="order-last flex w-full items-center gap-2 text-sm">
          <LinkIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground">This folder is public:</span>
          <Input
            readOnly
            value={publicUrl}
            aria-label="Public link"
            onFocus={(event) => event.target.select()}
            className="h-8 max-w-xl min-w-0"
          />
          <Button variant="outline" size="sm" onClick={copyPublicUrl}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
    </>
  );
}
