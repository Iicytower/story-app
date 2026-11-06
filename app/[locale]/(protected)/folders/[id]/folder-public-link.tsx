"use client";

import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const subscribeNever = () => () => {};

export function FolderPublicLink({ publicPath }: { publicPath: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("folders");
  // Empty during SSR, so the absolute link is only rendered after hydration.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const publicUrl = origin && origin + publicPath;

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!publicUrl) return null;
  return (
    <div className="order-last flex w-full items-center gap-2 text-sm">
      <LinkIcon className="text-muted-foreground size-4 shrink-0" />
      <span className="text-muted-foreground">{t("isPublic")}</span>
      <Input
        readOnly
        value={publicUrl}
        aria-label={t("publicLink")}
        onFocus={(event) => event.target.select()}
        className="h-8 max-w-xl min-w-0"
      />
      <Button variant="outline" size="sm" onClick={copyPublicUrl}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? t("copied") : t("copyLink")}
      </Button>
    </div>
  );
}
