"use client";

import { ExportDialog } from "@/components/export-dialog";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  Share2Icon,
} from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setFolderSharing } from "../actions";

const subscribeNever = () => () => {};

export function FolderShare({
  id,
  shareToken,
}: {
  id: string;
  shareToken?: string;
}) {
  const [sharePath, setSharePath] = useState(
    shareToken ? `/s/f/${shareToken}` : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // Empty during SSR, so the absolute link is only rendered after hydration.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const shareUrl = sharePath && origin + sharePath;

  function toggleSharing() {
    setError(null);
    startTransition(async () => {
      const result = await setFolderSharing(id, !sharePath);
      if (result.ok) {
        setSharePath(result.sharePath);
        setCopied(false);
      } else {
        setError(result.message);
      }
    });
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <a href={`/folders/${id}/export`} download>
            <DownloadIcon />
            Export .zip
          </a>
        </Button>
        <ExportDialog
          dataUrl={`/folders/${id}/export/data`}
          fallbackName="folder"
          chapterFiles
        />
        <Button variant="outline" onClick={toggleSharing} disabled={pending}>
          <Share2Icon />
          {sharePath ? "Stop sharing" : "Share"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive order-last w-full text-sm">
          {error}
        </p>
      )}
      {shareUrl && (
        <div className="order-last flex w-full items-center gap-2 text-sm">
          <LinkIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground">
            Anyone with this link can read the folder:
          </span>
          <Input
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={(event) => event.target.select()}
            className="h-8 max-w-xl min-w-0"
          />
          <Button variant="outline" size="sm" onClick={copyShareUrl}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
    </>
  );
}
