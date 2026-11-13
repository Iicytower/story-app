"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

// Rendered on the server too (no origin needed until a click), so the row does not
// appear after hydration and shift the page.
export function PublicLink({
  publicPath,
  className,
}: {
  publicPath: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("folders");
  const tMenu = useTranslations("menu");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    await navigator.clipboard.writeText(window.location.origin + publicPath);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="group"
      aria-label={t("publicLink")}
      className={cn(
        "flex h-8 items-center gap-1 text-sm whitespace-nowrap",
        className,
      )}
    >
      <GlobeIcon className="text-muted-foreground size-4 shrink-0" />
      {/* Matches the buttons' own padding so both sides of each separator look equal. */}
      <span className="text-muted-foreground pr-2.5">
        {tMenu("statusPublic")}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <Button variant="ghost" size="sm" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? t("copied") : t("copyLink")}
      </Button>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <Button variant="ghost" size="sm" asChild>
        <Link href={publicPath} target="_blank" rel="noopener">
          <ExternalLinkIcon />
          {t("openLink")}
        </Link>
      </Button>
    </div>
  );
}
