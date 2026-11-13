"use client";

import { BookmarkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "../../../../auth/auth-dialog";
import { TOOLBAR_CLASS } from "./reader-marks";

// A guest signs in first and comes back to the chapter (D42), like Add to library (task 72).
export function GuestMarks({ path }: { path: string }) {
  const t = useTranslations("marks");
  const locale = useLocale();
  return (
    <div role="toolbar" aria-label={t("toolbar")} className={TOOLBAR_CLASS}>
      <AuthDialog
        callbackUrl={`/${locale}${path}`}
        trigger={
          <Button variant="ghost" size="sm">
            <BookmarkIcon />
            {t("addBookmark")}
          </Button>
        }
      />
    </div>
  );
}
