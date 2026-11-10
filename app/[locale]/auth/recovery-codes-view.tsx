"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPathname } from "@/i18n/navigation";

// Shown once, after registering or after a reset with a code (D76). The server keeps only hashes.
export function RecoveryCodesView({
  codes,
  replaced,
  signedIn,
}: {
  codes: string[];
  // After a reset: the earlier codes no longer work.
  replaced: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("recovery");
  const locale = useLocale();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
  }

  function proceed() {
    // A full load, so the page and the layout read the new session.
    window.location.assign(
      getPathname({ href: signedIn ? "/" : "/?auth=login", locale }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{replaced ? t("replaced") : t("description")}</p>
      <ol
        aria-label={t("list")}
        className="bg-muted grid grid-cols-2 gap-x-6 gap-y-1 rounded-md p-3 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <Button variant="outline" onClick={() => void copy()}>
        {copied ? t("copied") : t("copy")}
      </Button>
      <Label className="flex items-center gap-2 text-sm font-normal">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {t("saved")}
      </Label>
      <Button disabled={!saved} onClick={proceed}>
        {t("continue")}
      </Button>
    </div>
  );
}
