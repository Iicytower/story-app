"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "../../../auth/auth-dialog";

// A guest signs in first and comes back to the book (D42).
export function GuestLibraryButton({ path }: { path: string }) {
  const t = useTranslations("library");
  const locale = useLocale();
  return (
    <AuthDialog
      callbackUrl={`/${locale}${path}`}
      trigger={<Button>{t("add")}</Button>}
    />
  );
}
