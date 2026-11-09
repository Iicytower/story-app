"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissCoverRejection } from "./cover-actions";

export function CoverRejected({ folderId }: { folderId: string }) {
  const t = useTranslations("covers");
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="alert"
      className="border-destructive/40 mt-2 flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
    >
      <span className="mr-auto">{t("rejected")}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await dismissCoverRejection(folderId);
          })
        }
      >
        {t("dismiss")}
      </Button>
    </div>
  );
}
