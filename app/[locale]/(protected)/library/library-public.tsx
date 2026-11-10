"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLibraryPublic } from "./actions";

export function LibraryPublic({ value }: { value: boolean }) {
  const t = useTranslations("library");
  const tErrors = useTranslations("errors");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setLibraryPublic(next);
        if (!result.ok) setError(result.message);
      } catch {
        setError(tErrors("offline"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          role="switch"
          checked={value}
          disabled={busy}
          onChange={(event) => change(event.target.checked)}
          aria-describedby="library-public-hint"
          className="accent-primary size-4"
        />
        {t("public")}
      </label>
      <p id="library-public-hint" className="text-muted-foreground text-sm">
        {t("publicHint")}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
