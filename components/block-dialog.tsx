"use client";

import { useTranslations } from "next-intl";
import { blockUser } from "@/app/[locale]/p/[nickname]/block-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

// Confirms blocking nickname from the profile or a comment's ⋮ menu (task 86).
export function BlockDialog({
  open,
  onOpenChange,
  nickname,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nickname: string;
  returnFocus: () => HTMLElement | null;
}) {
  const t = useTranslations("blocking");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("confirmTitle", { nickname })}
      description={t("confirmDescription", { nickname })}
      confirmLabel={t("block")}
      pendingLabel={t("blockingPending")}
      destructive
      action={() => blockUser(nickname)}
      returnFocus={returnFocus}
    />
  );
}
